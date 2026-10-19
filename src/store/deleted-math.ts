// What the player deleted, by list and id, with when. Two phones with the same
// cloud code join their copies by union, so without this a session deleted on
// one phone came back from the other's copy (with its money back in the
// bankroll). An item stays deleted unless it was edited after the delete:
// then the edit wins, as it does between two edits. Kept on the phone and in
// the backup (deleted.ts). Pure, so it can be tested without a phone.

import { sepId } from './bankroll-math';

export const DELETED_LISTS = ['hands', 'sessions', 'players', 'bankrolls', 'transfers', 'backers', 'packages', 'payments', 'trips', 'backing', 'ownFestivals', 'weekly'] as const;
export type DeletedList = (typeof DELETED_LISTS)[number];
/** 'sessions:<id>' → when it was deleted. */
export type Deleted = Record<string, number>;

/** The newest ones kept: about 150 KB of a 2 MB backup at most. */
const MAX = 5000;
const KEY_RE = new RegExp(`^(${DELETED_LISTS.join('|')}):[^\\n]{1,100}$`);

export const keyOf = (list: DeletedList, id: string) => `${list}:${id}`;

/**
 * A bankroll is deleted by id and currency (`bankrolls:<id>@<currency>`): two phones can hold one id in
 * two currencies (bankroll-math.ts), and a delete on one must not reach the other's. The mark covers the
 * bankroll under either of its names, its own id or the separated one (sepId), as foldSeparated treats
 * them as one. Marks from older builds have no currency and match the id alone.
 */
export const bankrollMark = (id: string, currency: string) => `${id}@${currency}`;

function keysOf(list: DeletedList, x: { id: string; currency?: unknown }): string[] {
  if (list !== 'bankrolls' || typeof x.currency !== 'string') return [keyOf(list, x.id)];
  const c = x.currency;
  const keys = [keyOf(list, x.id), keyOf(list, bankrollMark(x.id, c)), keyOf(list, bankrollMark(sepId(x.id, c), c))];
  const cut = x.id.lastIndexOf('~');
  if (cut > 0 && x.id === sepId(x.id.slice(0, cut), c)) keys.push(keyOf(list, bankrollMark(x.id.slice(0, cut), c)));
  return keys;
}

function capped(d: Deleted): Deleted {
  const keys = Object.keys(d);
  if (keys.length <= MAX) return d;
  return Object.fromEntries(keys.sort((a, b) => d[b] - d[a]).slice(0, MAX).map((k) => [k, d[k]]));
}

/**
 * Only well-formed keys with a real time: a hand-made file can't drop anything else. A time
 * more than a day ahead is left out, or it would keep beating every later edit.
 */
export function cleanDeleted(x: unknown, now = Date.now()): Deleted {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: Deleted = {};
  for (const [k, v] of Object.entries(x)) if (KEY_RE.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= now + 86_400_000) out[k] = v;
  return capped(out);
}

/** Both phones' deletes; the later time of each. */
export function joinDeleted(a: Deleted | undefined, b: Deleted | undefined): Deleted {
  const out: Deleted = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) if (!(out[k] >= v)) out[k] = v;
  return capped(out);
}

/** The list without what was deleted after its last edit. The same array when nothing goes. */
export function alive<T extends { id: string; updatedAt?: number }>(items: T[], list: DeletedList, d: Deleted): T[] {
  const gone = (x: T) => keysOf(list, x).some((k) => d[k] !== undefined && d[k] >= (x.updatedAt ?? 0));
  return items.some(gone) ? items.filter((x) => !gone(x)) : items;
}


/**
 * A restore brings back what it holds, even what was deleted on this phone: those items come back
 * with a fresh edit time, so another phone's older delete can't drop them again on the next copy.
 * Returns the lists to use and the keys revived (no longer deleted here).
 */
export function revive<B extends Partial<Record<DeletedList, { id: string; updatedAt?: number }[]>>>(backup: B, here: Deleted, now: number): { backup: B; revived: string[] } {
  const revived: string[] = [];
  const out: B = { ...backup };
  for (const k of DELETED_LISTS) {
    const list = backup[k];
    const marks = (x: { id: string }) => keysOf(k, x).filter((key) => here[key] !== undefined);
    if (!list?.some((x) => marks(x).length)) continue;
    (out as Record<DeletedList, unknown>)[k] = list.map((x) => {
      const m = marks(x);
      if (!m.length) return x;
      revived.push(...m);
      return { ...x, updatedAt: now };
    });
  }
  return { backup: out, revived };
}
