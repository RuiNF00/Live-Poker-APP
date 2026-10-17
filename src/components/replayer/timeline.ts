// One motion timeline for the hand, shared by the in-app replayer and the Story/reel export:
// how long each step is held and which animations play when it comes on screen.

import type { Replay } from '@/poker/engine';
import type { Hand } from '@/poker/types';

/** Playback beat and animation lengths, in ms. */
export const MOTION = {
  step: 1100,
  /** A new street is held a beat longer, like a dealer burning and turning. */
  streetHold: 1.4,
  end: 2200,
  rise: 300,
  riseStagger: 80,
  fly: 420,
  flyStagger: 90,
} as const;

export type MotionAnim =
  /** Board card `card` (0–4) rises onto the felt. */
  | { kind: 'boardRise'; card: number; start: number; dur: number }
  /** The bets of the step before sweep into the pot. */
  | { kind: 'potGather'; bets: { seat: number; amount: number }[]; start: number; dur: number }
  /** The pot slides to a winner. */
  | { kind: 'chipsToWinner'; seat: number; amount: number; start: number; dur: number };

export interface MotionStep {
  k: number;
  /** How long the step stays on screen at 1× before the next one. */
  ms: number;
  /** Played when the step comes on screen going forward. Empty under Reduce Motion. */
  anims: MotionAnim[];
}

/**
 * Every step of the replay with its hold time and the animations that play as it arrives.
 * Under Reduce Motion each step keeps its `ms` and gets no animations.
 */
export function motionTimeline(_hand: Hand, r: Replay, opts: { reduce?: boolean } = {}): MotionStep[] {
  const steps = r.steps;
  const last = steps.length - 1;
  return steps.map((step, k) => {
    const ms = k === last ? MOTION.end : steps[k + 1]?.kind === 'board' ? MOTION.step * MOTION.streetHold : MOTION.step;
    const anims: MotionAnim[] = [];
    const prev = k > 0 ? steps[k - 1].state : null;
    if (!opts.reduce && prev) {
      const st = step.state;
      if (step.kind === 'board') {
        const from = prev.boardCount;
        for (let c = from; c < st.boardCount; c++) anims.push({ kind: 'boardRise', card: c, start: (c - from) * MOTION.riseStagger, dur: MOTION.rise });
      }
      const swept = prev.bets.map((amount, seat) => ({ seat, amount })).filter((b) => b.amount > 0 && st.bets[b.seat] === 0);
      if (st.pot > prev.pot && swept.length && step.kind !== 'showdown') anims.push({ kind: 'potGather', bets: swept, start: 0, dur: MOTION.fly });
      if (k === last && r.result) {
        const winners = r.result.won.map((amount, seat) => ({ seat, amount })).filter((w) => w.amount > 0);
        winners.forEach((w, j) => anims.push({ kind: 'chipsToWinner', seat: w.seat, amount: w.amount, start: j * MOTION.flyStagger, dur: MOTION.fly }));
      }
    }
    return { k, ms, anims };
  });
}

/** 0→1 progress of an animation `at` ms into its step. */
export function progressAt(a: { start: number; dur: number }, at: number): number {
  return Math.max(0, Math.min(1, (at - a.start) / a.dur));
}
