import { describe, expect, it } from 'vitest';
import { SAMPLE_TOURNAMENT_HAND, buildReplay } from '@livepoker/hand-format';
import { stepsOf, streetOfStep, streetStep } from '../src/lib/hand';

describe('comments by street', () => {
  const steps = stepsOf(SAMPLE_TOURNAMENT_HAND)!;

  it('a comment on a step belongs to that step street; no step = the whole hand', () => {
    expect(steps).toEqual(buildReplay(SAMPLE_TOURNAMENT_HAND));
    const flop = steps.findIndex((s) => s.street === 'flop' && s.kind === 'action');
    expect(streetOfStep(steps, flop)).toBe('flop');
    expect(streetOfStep(steps, null)).toBeNull();
    expect(streetOfStep(steps, 9999)).toBeNull();
  });

  it('a comment sent "about the turn" points at the step that deals the turn', () => {
    const i = streetStep(steps, 'turn')!;
    expect(steps[i]).toMatchObject({ kind: 'street', street: 'turn' });
    expect(streetStep(steps, 'preflop')).toBe(0);
  });

  it('a payload that does not replay gives no steps', () => {
    expect(stepsOf({ nope: true })).toBeNull();
  });
});
