// What the player deleted, by list and id, with when. Two phones with the same
// cloud code join their copies by union, so without this a session deleted on
// one phone came back from the other's copy (with its money back in the
// bankroll). An item stays deleted unless it was edited after the delete:
// then the edit wins, as it does between two edits. Kept on the phone and in
// the backup (deleted.ts). Pure, so it can be tested without a phone.

export const DELETED_LISTS = ['hands', 'sessions', 'players', 'bankrolls', 'transfers', 'backers', 'packages', 'payments', 'trips', 'backing'] as const;
export type DeletedList = (typeof DELETED_LISTS)[number];
/** 'sessions:<id>' → when it was deleted. */
export type Deleted = Record<string, number>;

/** The newest ones kept: about 150 KB of a 2 MB backup at most. */
const MAX = 5000;
const KEY_RE = new RegExp(`^(${DELETED_LISTS.join('|')}):[^\\n]{1,100}$`);

export const keyOf = (list: DeletedList, id: string) => `${list}:${id}`;

function capped(d: Deleted): Deleted {
  const keys = Object.keys(d);
  if (keys.length <= MAX) return d;
  return Object.fromEntries(keys.sort((a, b) => d[b] - d[a]).slice(0, MAX).map((k) => [k, d[k]]));
}

/** Only well-formed keys with a real time: a hand-made file can't drop anything else. */
export function cleanDeleted(x: unknown): Deleted {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: Deleted = {};
  for (const [k, v] of Object.entries(x)) if (KEY_RE.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
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
  const gone = (x: T) => {
    const at = d[keyOf(list, x.id)];
    return at !== undefined && at >= (x.updatedAt ?? 0);
  };
  return items.some(gone) ? items.filter((x) => !gone(x)) : items;
}

