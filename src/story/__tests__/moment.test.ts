/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import type { Hand } from '../../poker/types';
import { canAsk, decisionStep, storyMoment } from '../moment';

test("question freezes on hero's last decision", () => {
  const hand = sampleHand('s');
  const m = storyMoment(hand, 'question', false);
  assert.equal(m.mode, 'question');
  assert.equal(m.step.state.toAct, hand.hero);
  assert.equal(m.street, 'preflop');
  assert.equal(m.toCall, '18k');
  assert.deepEqual(
    m.options.map((o) => [o.label, o.taken]),
    [
      ['Fold', false],
      ['Call 18k', false],
      ['All-in 64k', true],
    ],
  );
  // Nobody's cards but hero's are known yet at that frame.
  assert.equal(m.step.state.boardCount, 0);
});

test('result shows the last frame with the pot', () => {
  const m = storyMoment(sampleHand('s'), 'result', true);
  assert.equal(m.mode, 'result');
  assert.equal(m.stepIndex, m.replay.steps.length - 1);
  assert.ok(m.replay.result);
  assert.match(m.pot, /bb$/);
});

test('hero who never acted falls back to the result', () => {
  const hand: Hand = { ...sampleHand('s'), actions: sampleHand('s').actions.slice(0, 5) };
  assert.equal(decisionStep(hand), null);
  assert.equal(canAsk(hand), false);
  assert.equal(storyMoment(hand, 'question', false).mode, 'result');
});

test('unopened pot offers check or bet', () => {
  const base = sampleHand('s');
  const hand: Hand = {
    ...base,
    players: base.players.slice(0, 2),
    button: 0,
    hero: 0,
    // HU: button is SB and acts first preflop.
    actions: [
      { p: 0, kind: 'call' },
      { p: 1, kind: 'check' },
      { p: 1, kind: 'check' },
      { p: 0, kind: 'bet', to: 3000 },
      { p: 1, kind: 'fold' },
    ],
  };
  const m = storyMoment(hand, 'question', false);
  assert.equal(m.street, 'flop');
  assert.equal(m.toCall, null);
  assert.deepEqual(
    m.options.map((o) => o.label),
    ['Check', 'Bet 3000', 'All-in 62k'],
  );
});
