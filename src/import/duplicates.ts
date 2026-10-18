// Sessions in an imported file that look like ones already in Sweatbook: the same
// night logged in another app, or typed by hand before switching. Importing the
// same file twice is already handled by the id; this catches what the id can't.
// Venue and name don't count, as every app writes them its own way.

import { profit } from '../store/session-math';
import type { Session } from '../store/types';

const SIX_HOURS = 6 * 3600_000;

const dayKey = (t: number) => {
  const d = new Date(t);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

// The other app may have kept expenses or a stake out of its result: either one matching is enough.
const results = (s: Session) => [...new Set([profit(s), (s.cashOut || 0) - (s.buyIn || 0) * (s.entries || 1) - (s.addOn || 0)].map((v) => Math.round(v * 100)))];

/** Ids of incoming sessions that match an existing one, each existing session matched at most once. */
export function likelyDuplicates(incoming: Session[], existing: Session[]): Set<string> {
  const have = new Set(existing.map((s) => s.id));
  const byKey = new Map<string, Session[]>();
  for (const s of existing)
    for (const r of results(s)) {
      const k = [s.kind, s.currency, r].join('|');
      const list = byKey.get(k);
      if (list) list.push(s);
      else byKey.set(k, [s]);
    }
  const used = new Set<string>();
  const out = new Set<string>();
  for (const s of incoming) {
    // Same id: the import merges it anyway.
    if (have.has(s.id)) continue;
    const near = (e: Session) => !used.has(e.id) && (dayKey(e.startedAt) === dayKey(s.startedAt) || Math.abs(e.startedAt - s.startedAt) < SIX_HOURS);
    let pair: Session | undefined;
    for (const r of results(s)) if ((pair = byKey.get([s.kind, s.currency, r].join('|'))?.find(near))) break;
    if (pair) {
      used.add(pair.id);
      out.add(s.id);
    }
  }
  return out;
}
