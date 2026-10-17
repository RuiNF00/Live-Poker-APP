// Derived data over the whole history, written to stay fast with thousands of
// hands. Pure, so it can be tested and measured in Node.

import type { Hand } from '@/poker/types';

import type { PlayerNote } from './types';

const norm = (s: string) => s.trim().toLowerCase();

/** Hands per player in one pass over the history, instead of one pass per row. */
export function handCounts(hands: Hand[], players: PlayerNote[]): Map<string, number> {
  const byName = new Map<string, string[]>();
  for (const p of players) {
    const n = norm(p.name);
    if (n) byName.set(n, [...(byName.get(n) ?? []), p.id]);
  }
  const ids = new Set(players.map((p) => p.id));
  const counts = new Map<string, number>();
  for (const h of hands) {
    const seen = new Set<string>();
    h.players.forEach((x, i) => {
      if (i === h.hero) return;
      if (x.playerId && ids.has(x.playerId)) seen.add(x.playerId);
      for (const id of (x.name && byName.get(norm(x.name))) || []) seen.add(id);
    });
    for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

