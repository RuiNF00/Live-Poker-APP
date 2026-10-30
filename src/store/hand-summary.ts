// A hand's result and whether it is complete, without replaying every hand on every launch.
//
// The hands list, its «Por completar» count, the result filter and the CSV need, per hand, hero's
// result and whether anything is missing. Getting them means replaying the hand, which with years
// of hands took seconds on a phone at each launch. Now each answer is kept on the phone with the
// hand's version (updatedAt, which every save changes, plus the sizes of what the replay reads),
// so a launch replays only the hands saved since the last one.
//
// What is kept is derived data, never the source: unreadable, from another app version or from an
// older hand version, it is simply worked out again. Pure (storage is passed in), so the tests run
// it in Node.

import { isComplete, replayFinal } from '@/poker/engine';
import type { Hand } from '@/poker/types';

import type { KV } from './persist';

export interface HandSummary {
  /** Hero's result once every pot has a winner. */
  net: number | undefined;
  /** Hero's result as the replay has it, settled or not (the CSV's result column). */
  raw: number | undefined;
  /** Nothing missing: no action, card or winner to add (isComplete). */
  done: boolean;
}

/**
 * Raise when replay() can give a different result or completeness for a hand already saved: the
 * answers kept on the phone are then all worked out again. A new app version does that anyway.
 */
export const SUMMARY_VERSION = 1;
export const SUMMARY_PREFIX = 'rl.handsum.v1.';
/** Hands per stored value: far under Android's 2 MB per value with any id length. */
const PER_KEY = 4000;

type Entry = [key: string, net: number | null, raw: number | null, done: 0 | 1];

const memo = new WeakMap<Hand, HandSummary>();
let known = new Map<string, Entry>();
let changed = false;

/** What a kept answer is checked against: every save changes updatedAt; the sizes guard anything else. */
export function summaryKey(h: Hand): string {
  return `${h.updatedAt}.${h.players.length}.${h.actions.length}.${h.board.length}.${h.board2?.length ?? 0}`;
}

/** Replays the hand. */
export function computeSummary(h: Hand): HandSummary {
  const r = replayFinal(h);
  return { net: r.result?.resolved ? r.result.net[h.hero] : undefined, raw: r.result?.net[h.hero], done: isComplete(h, r) };
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export function handSummary(h: Hand): HandSummary {
  let v = memo.get(h);
  if (v) return v;
  const e = known.get(h.id);
  const k = summaryKey(h);
  if (e && e[0] === k) v = { net: e[1] ?? undefined, raw: e[2] ?? undefined, done: e[3] === 1 };
  else {
    v = computeSummary(h);
    known.set(h.id, [k, num(v.net), num(v.raw), v.done ? 1 : 0]);
    changed = true;
  }
  memo.set(h, v);
  return v;
}

/** Reads what was kept. Never rejects; what it can't use is left to be worked out again. */
export async function loadSummaries(kv: KV, build: string): Promise<number> {
  let n = 0;
  try {
    const keys = (await kv.getAllKeys()).filter((k) => k.startsWith(SUMMARY_PREFIX));
    if (!keys.length) return 0;
    for (const [, raw] of await kv.multiGet(keys)) {
      let v: unknown;
      try {
        v = raw == null ? null : JSON.parse(raw);
      } catch {
        continue;
      }
      const d = v as { b?: unknown; e?: unknown } | null;
      if (!d || d.b !== build || !Array.isArray(d.e)) continue;
      for (const x of d.e as unknown[]) {
        if (!Array.isArray(x) || typeof x[0] !== 'string' || typeof x[1] !== 'string' || known.has(x[0])) continue;
        known.set(x[0], [x[1], num(x[2]), num(x[3]), x[4] === 1 ? 1 : 0]);
        n++;
      }
    }
  } catch {
    // Nothing kept, or storage unreadable: every hand is replayed, as before.
  }
  return n;
}

/**
 * Keeps the answers for `hands` (the whole current list, so deleted hands drop out). Writes only
 * when something was worked out since the last save or the list shrank.
 */
export async function saveSummaries(kv: KV, build: string, hands: readonly Hand[]): Promise<boolean> {
  const rows: [string, string, number | null, number | null, 0 | 1][] = [];
  for (const h of hands) {
    const e = known.get(h.id);
    if (e && e[0] === summaryKey(h)) rows.push([h.id, ...e]);
  }
  if (!changed && rows.length === known.size) return false;
  changed = false;
  const live = new Set(rows.map((r) => r[0]));
  for (const id of [...known.keys()]) if (!live.has(id)) known.delete(id);
  const pairs: [string, string][] = [];
  for (let i = 0; i * PER_KEY < rows.length; i++) pairs.push([SUMMARY_PREFIX + i, JSON.stringify({ b: build, e: rows.slice(i * PER_KEY, (i + 1) * PER_KEY) })]);
  const old = (await kv.getAllKeys()).filter((k) => k.startsWith(SUMMARY_PREFIX) && !pairs.some((p) => p[0] === k));
  if (pairs.length) await kv.multiSet(pairs);
  if (old.length) await kv.multiRemove(old);
  return true;
}

/** «Apagar todos os meus dados»: nothing kept in memory is written back. */
export function forgetSummaries() {
  known = new Map();
  changed = false;
}
