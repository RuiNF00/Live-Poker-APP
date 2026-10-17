// Derived data over the whole history, written to stay fast with thousands of
// hands. Pure, so it can be tested and measured in Node.

import { replay } from '@/poker/engine';
import type { Hand } from '@/poker/types';

import type { PlayerNote } from './types';

const norm = (s: string) => s.trim().toLowerCase();

function nameIndex(players: PlayerNote[]) {
  const byName = new Map<string, string[]>();
  for (const p of players) {
    const n = norm(p.name);
    if (n) byName.set(n, [...(byName.get(n) ?? []), p.id]);
  }
  return byName;
}

/** Seats of a hand held by known players: by the linked note, or by name. */
function knownSeats(h: Hand, ids: Set<string>, byName: Map<string, string[]>): [number, string][] {
  const out: [number, string][] = [];
  h.players.forEach((x, i) => {
    if (i === h.hero) return;
    const seen = new Set<string>();
    if (x.playerId && ids.has(x.playerId)) seen.add(x.playerId);
    for (const id of (x.name && byName.get(norm(x.name))) || []) seen.add(id);
    for (const id of seen) out.push([i, id]);
  });
  return out;
}

/** Hands per player in one pass over the history, instead of one pass per row. */
export function handCounts(hands: Hand[], players: PlayerNote[]): Map<string, number> {
  const byName = nameIndex(players);
  const ids = new Set(players.map((p) => p.id));
  const counts = new Map<string, number>();
  for (const h of hands) {
    for (const id of new Set(knownSeats(h, ids, byName).map(([, id]) => id))) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Sessions each known player was seen in (a hand outside a session counts by its day). */
export function sessionsSeen(hands: Hand[], players: PlayerNote[]): Map<string, number> {
  const byName = nameIndex(players);
  const ids = new Set(players.map((p) => p.id));
  const seen = new Map<string, Set<string>>();
  for (const h of hands) {
    const seats = knownSeats(h, ids, byName);
    if (!seats.length) continue;
    const d = new Date(h.createdAt);
    const key = h.sessionId ?? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    for (const [, id] of seats) seen.set(id, (seen.get(id) ?? new Set()).add(key));
  }
  return new Map([...seen].map(([id, keys]) => [id, keys.size]));
}

/**
 * Preflop reads from the hands entered against each player. A hand counts once
 * the player has a preflop action in it (walks and unfinished hands don't).
 * VPIP: called or raised. PFR: raised. 3-bet: raised when facing exactly one raise.
 */
export interface OpponentStats {
  hands: number;
  vpip: number;
  pfr: number;
  threeBet: number;
  threeBetOpp: number;
}

/** Below this many hands the numbers are a hint, not a read. */
export const SMALL_SAMPLE = 20;

export function opponentStats(hands: Hand[], players: PlayerNote[]): Map<string, OpponentStats> {
  const byName = nameIndex(players);
  const ids = new Set(players.map((p) => p.id));
  const out = new Map<string, OpponentStats>();
  for (const h of hands) {
    const seats = knownSeats(h, ids, byName);
    if (!seats.length) continue;
    // Per seat: what it did preflop, and whether it faced a single raise.
    const acted = new Set<number>();
    const vpip = new Set<number>();
    const pfr = new Set<number>();
    const tbOpp = new Set<number>();
    const tb = new Set<number>();
    let raises = 0;
    for (const st of replay(h).steps) {
      if (st.kind !== 'action' || st.actStreet !== 'preflop' || st.actionIndex === undefined) continue;
      const a = h.actions[st.actionIndex];
      const first = !acted.has(a.p);
      acted.add(a.p);
      if (raises === 1 && first) tbOpp.add(a.p);
      if (a.kind === 'call') vpip.add(a.p);
      if (a.kind === 'raise' || a.kind === 'bet') {
        vpip.add(a.p);
        pfr.add(a.p);
        if (raises === 1 && tbOpp.has(a.p)) tb.add(a.p);
        raises++;
      }
    }
    const counted = new Set<string>();
    for (const [i, id] of seats) {
      if (!acted.has(i) || counted.has(id)) continue;
      counted.add(id);
      const o = out.get(id) ?? { hands: 0, vpip: 0, pfr: 0, threeBet: 0, threeBetOpp: 0 };
      o.hands++;
      if (vpip.has(i)) o.vpip++;
      if (pfr.has(i)) o.pfr++;
      if (tbOpp.has(i)) o.threeBetOpp++;
      if (tb.has(i)) o.threeBet++;
      out.set(id, o);
    }
  }
  return out;
}
