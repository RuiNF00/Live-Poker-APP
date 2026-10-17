/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '@/poker/engine';
import { sampleHand } from '@/poker/sample';

import { viewAt } from '../model';
import { MOTION, motionTimeline, progressAt } from '../timeline';

const hand = sampleHand('sample');
const r = replay(hand);
const tl = motionTimeline(hand, r);

test('one entry per replay step, a street held longer and the end longest', () => {
  assert.equal(tl.length, r.steps.length);
  tl.forEach((s, k) => assert.equal(s.k, k));
  const before = r.steps.findIndex((s, k) => k > 0 && r.steps[k + 1]?.kind === 'board');
  assert.equal(tl[before].ms, MOTION.step * MOTION.streetHold);
  assert.equal(tl[tl.length - 1].ms, MOTION.end);
  assert.deepEqual(tl[0].anims, []);
});

test('the flop rises card by card and the bets before it gather into the pot', () => {
  const flop = r.steps.findIndex((s) => s.kind === 'board' && s.street === 'flop');
  const rise = tl[flop].anims.filter((a) => a.kind === 'boardRise');
  assert.deepEqual(
    rise.map((a) => (a.kind === 'boardRise' ? [a.card, a.start] : null)),
    [0, 1, 2].map((c) => [c, c * MOTION.riseStagger]),
  );
  // The preflop bets are swept by the action that closes the street.
  const gathers = tl.filter((s) => s.anims.some((a) => a.kind === 'potGather'));
  assert.ok(gathers.length > 0);
  for (const g of gathers) {
    const prev = r.steps[g.k - 1].state;
    for (const a of g.anims) if (a.kind === 'potGather') for (const b of a.bets) assert.equal(b.amount, prev.bets[b.seat]);
  }
});

test('the winner gets the chips on the last step', () => {
  const end = tl[tl.length - 1].anims.filter((a) => a.kind === 'chipsToWinner');
  assert.ok(end.length > 0);
  const total = end.reduce((t, a) => t + (a.kind === 'chipsToWinner' ? a.amount : 0), 0);
  assert.equal(total, r.result!.won.reduce((t, x) => t + x, 0));
});

test('Reduce Motion keeps every hold time but plays nothing', () => {
  const still = motionTimeline(hand, r, { reduce: true });
  assert.deepEqual(
    still.map((s) => s.ms),
    tl.map((s) => s.ms),
  );
  assert.ok(still.every((s) => s.anims.length === 0));
});

test('a still frame carries the step animations and its moment', () => {
  const flop = r.steps.findIndex((s) => s.kind === 'board' && s.street === 'flop');
  const v = viewAt(hand, r, flop, { inBB: false, reveal: false, atEnd: false, at: 120 });
  assert.deepEqual(v.motion, { anims: tl[flop].anims, at: 120 });
  assert.equal(viewAt(hand, r, flop, { inBB: false, reveal: false, atEnd: false }).motion, undefined);
  const a = { start: 80, dur: 300 };
  assert.equal(progressAt(a, 0), 0);
  assert.equal(progressAt(a, 230), 0.5);
  assert.equal(progressAt(a, 999), 1);
});
