// Picks the frame of a hand that goes on an Instagram story.
//
// "question": the table frozen on hero's last decision, result hidden, with the
// options hero had. Viewers have to open the link to vote and see what
// happened, which is what turns a story view into a visit.
// "result": the last frame, cards shown and the pot pushed.

import { legal, replay, totalPot, type Replay, type Step } from '@/poker/engine';
import { amount } from '@/poker/format';
import type { Hand, Street } from '@/poker/types';

export type StoryMode = 'question' | 'result';

export interface StoryOption {
  label: string;
  /** What hero actually did. Never drawn on a question story. */
  taken: boolean;
}

export interface StoryMoment {
  mode: StoryMode;
  replay: Replay;
  stepIndex: number;
  step: Step;
  street: Street;
  /** Pot in the middle at this frame, formatted. */
  pot: string;
  /** Hero's choices at the decision (question mode only). */
  options: StoryOption[];
  /** "para pagar 34k" when hero faces a bet. */
  toCall: string | null;
}

/** Steps index of the frame just before hero's last decision: the spot people argue about. */
export function decisionStep(hand: Hand, r: Replay = replay(hand)): number | null {
  for (let k = r.steps.length - 1; k > 0; k--) {
    const st = r.steps[k];
    if (st.kind === 'action' && st.state.last?.p === hand.hero) return k - 1;
  }
  return null;
}

/** Whether a hand can be posted as a question (hero made at least one decision). */
export function canAsk(hand: Hand): boolean {
  return decisionStep(hand) !== null;
}

export function storyMoment(hand: Hand, mode: StoryMode, inBB: boolean): StoryMoment {
  const r = replay(hand);
  const last = r.steps.length - 1;
  const q = mode === 'question' ? decisionStep(hand, r) : null;
  if (q === null) {
    const step = r.steps[last];
    const pot = r.result ? r.result.pots.reduce((a, p) => a + p.amount, 0) : totalPot(step.state);
    return { mode: 'result', replay: r, stepIndex: last, step, street: step.street, pot: amount(pot, hand, inBB), options: [], toCall: null };
  }

  const step = r.steps[q];
  const s = step.state;
  const lg = legal(s);
  const taken = r.steps[q + 1].state.last;
  const options: StoryOption[] = [];
  if (lg) {
    const allInTo = lg.maxTo;
    const callAllIn = lg.canCall && lg.toCall >= s.stacks[lg.p];
    if (lg.canCall) options.push({ label: 'Fold', taken: taken?.kind === 'fold' });
    if (lg.canCheck) options.push({ label: 'Check', taken: taken?.kind === 'check' });
    if (lg.canCall) options.push({ label: callAllIn ? 'Call all-in' : 'Call ' + amount(lg.toCall, hand, inBB), taken: taken?.kind === 'call' });
    if (lg.canBet || lg.canRaise) {
      const verb = lg.canBet ? 'Bet' : 'Raise';
      const shove = !!taken?.allIn && taken.kind !== 'call';
      const sized = (taken?.kind === 'bet' || taken?.kind === 'raise') && !shove;
      // Show hero's real sizing so the poll is the actual spot; offer a shove next to it.
      if (sized && taken) options.push({ label: verb + ' ' + amount(taken.to, hand, inBB), taken: true });
      else if (!shove && allInTo > lg.minTo) options.push({ label: verb, taken: false });
      options.push({ label: 'All-in ' + amount(allInTo, hand, inBB), taken: shove });
    }
  }
  // Three pills fit the story; keep the one hero took.
  while (options.length > 3) {
    const k = options.findLastIndex((o) => !o.taken);
    options.splice(k, 1);
  }
  return {
    mode: 'question',
    replay: r,
    stepIndex: q,
    step,
    street: step.state.street,
    pot: amount(totalPot(s), hand, inBB),
    options,
    toCall: lg && lg.canCall ? amount(lg.toCall, hand, inBB) : null,
  };
}
