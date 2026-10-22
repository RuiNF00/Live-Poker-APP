// «O que fazes aqui?» with the player's own hands. A hand reviewed from a queue stops at hero's
// decision and asks first (answering before seeing is what makes it stick), then comes back 3 days
// and a week later, the spacing that holds best. Pure, so it can be tested; drill-store keeps it.

import { needsReview } from './review';
import type { Hand } from './types';

const DAY = 86_400_000;
/** After the first answer, then after the second: then the hand is done. */
export const DRILL_GAPS = [3 * DAY, 7 * DAY] as const;
/** «Treino da semana»: at most this many hands in one go. */
export const DRILL_MAX = 3;

/** By hand id: the next time it is asked, and how many times it was answered. */
export type DrillState = Record<string, { due: number; done: number }>;

/** The player answered `id`'s question: plan the next one, or drop the hand after the last gap. */
export function answered(state: DrillState, id: string, now: number): DrillState {
  const done = (state[id]?.done ?? 0) + 1;
  const { [id]: _, ...rest } = state;
  if (done > DRILL_GAPS.length) return rest;
  return { ...rest, [id]: { due: now + DRILL_GAPS[done - 1], done } };
}

/** A hand comes back for a question: due, or still waiting for its first review. */
export function isDue(h: Hand, state: DrillState, now: number): boolean {
  const s = state[h.id];
  return s ? s.due <= now : needsReview(h);
}

/**
 * «Treino da semana»: hands due again first (longest waiting first), then the ones marked for
 * review, oldest first; at most DRILL_MAX. Deleted hands simply aren't there.
 */
export function drillQueue(hands: readonly Hand[], state: DrillState, now: number, max = DRILL_MAX): Hand[] {
  const again = hands.filter((h) => state[h.id] && state[h.id].due <= now).sort((a, b) => state[a.id].due - state[b.id].due);
  const fresh = hands.filter((h) => !state[h.id] && needsReview(h)).sort((a, b) => a.createdAt - b.createdAt);
  return [...again, ...fresh].slice(0, max);
}
