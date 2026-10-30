/// <reference types="node" />
// replayFinal: replay() without the steps, on one state instead of a copy per action. It must give
// exactly what replay() gives. Checked on thousands of random hands (every game shape the engine
// knows, finished or left half-way, with refused actions) and on the big history.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay, replayFinal } from '../engine';
import type { Hand } from '../types';
import { randomHand } from './random-hand';
import { bigSessionsAndHands } from '../../../scripts/big-history';

const same = (h: Hand) => {
  const { steps, ...full } = replay(h);
  assert.deepEqual(replayFinal(h), full, h.id);
  // The final state is the last one replay() kept (before its showdown copy).
  const last = steps.filter((x) => x.kind !== 'showdown').at(-1)!.state;
  assert.deepEqual(full.final, last, h.id);
};

test('replayFinal gives what replay gives: 5 000 random hands', () => {
  let results = 0;
  let refused = 0;
  let unfinished = 0;
  for (let i = 1; i <= 5000; i++) {
    const h = randomHand(i);
    same(h);
    const r = replay(h);
    if (r.result) results++;
    if (r.invalidAt !== null) refused++;
    if (!r.result) unfinished++;
  }
  // The sample covers each kind of hand.
  assert.ok(results > 1000 && refused > 100 && unfinished > 500, `${results} ${refused} ${unfinished}`);
});

test('replayFinal gives what replay gives: the big history', () => {
  for (const h of bigSessionsAndHands(200, 10).hands) same(h);
});

test('replayFinal leaves the hand untouched and can run twice', () => {
  const h = randomHand(77);
  const before = JSON.stringify(h);
  const a = replayFinal(h);
  const b = replayFinal(h);
  assert.equal(JSON.stringify(h), before);
  assert.deepEqual(a, b);
  assert.notEqual(a.final, b.final);
});
