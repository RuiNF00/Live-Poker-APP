/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '../../poker/engine';
import { sampleHand } from '../../poker/sample';
import { REEL_MAX_S, REEL_MIN_S, reelDurations, reelSteps } from '../reel';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('frames skip other players folding but keep the deal, streets, hero and the end', () => {
  const hand = sampleHand('s');
  const r = replay(hand);
  const steps = reelSteps(hand, r);
  const last = r.steps.length - 1;
  assert.equal(steps[0], 0);
  assert.equal(steps.at(-1), last);
  for (const k of steps) {
    const s = r.steps[k];
    if (s.kind === 'action' && s.state.last?.kind === 'fold') assert.equal(s.state.last.p, hand.hero);
  }
  r.steps.forEach((s, k) => {
    if (s.kind === 'board') assert.ok(steps.includes(k), 'street ' + s.street);
    if (s.kind === 'action' && s.state.last?.p === hand.hero) assert.ok(steps.includes(k), 'hero action ' + k);
  });
  assert.ok(steps.length < r.steps.length);
});

test('long hands are thinned to the frame cap without losing streets or the end', () => {
  const hand = sampleHand('s');
  const r = replay(hand);
  const steps = reelSteps(hand, r, 5);
  assert.ok(steps.length <= 5);
  assert.equal(steps.at(-1), r.steps.length - 1);
  assert.deepEqual([...steps].sort((a, b) => a - b), steps);
});

test('the video lasts 15 to 30 s, covers the voice, and ends on a long hold', () => {
  const hand = sampleHand('s');
  const r = replay(hand);
  const steps = reelSteps(hand, r);
  const plain = reelDurations(r, steps);
  assert.equal(plain.length, steps.length);
  assert.ok(sum(plain) >= REEL_MIN_S - 0.05 && sum(plain) <= REEL_MAX_S + 0.05);
  assert.ok(plain.at(-1)! >= 3);
  assert.ok(plain.every((d) => d > 0.3));

  const voiced = reelDurations(r, steps, 24);
  assert.ok(sum(voiced) >= 24.4);
  assert.ok(sum(reelDurations(r, steps, 90)) <= REEL_MAX_S + 0.05);
});
