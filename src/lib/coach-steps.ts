// The coach comments on a replay step of the web replayer (packages/hand-format). The phone
// builds the same steps from the hand, so a comment reads "Turn · BTN bet 12 bb" here too.

import { buildReplay, describeStep, fromAppHand, isAppHand, streetLabel, type Locale } from '../../packages/hand-format/src';

import { publicHand } from '@/poker/privacy';
import type { Hand } from '@/poker/types';

export function stepLabeller(hand: Hand, locale: Locale): (i: number | null) => string {
  let steps: ReturnType<typeof buildReplay> = [];
  let bb = 1;
  try {
    const app = publicHand(hand, { names: true, notes: false });
    if (isAppHand(app)) {
      const rec = fromAppHand(app).hand;
      steps = buildReplay(rec, { revealAll: true, locale });
      bb = rec.blinds.bb;
    }
  } catch {
    steps = [];
  }
  return (i) => {
    const x = i === null ? undefined : steps[i];
    if (!x) return '';
    const d = describeStep(x, bb, 'bb', locale);
    return x.kind === 'action' ? `${streetLabel(x.street, locale)} · ${d}` : d;
  };
}
