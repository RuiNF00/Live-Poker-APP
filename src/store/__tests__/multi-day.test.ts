/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bagDay, dayOf, isBagged, reenterFlight, resumeDay } from '../multi-day';
import { cost, playedMs, profit, totals } from '../session-math';
import type { Session } from '../types';

const H = 3_600_000;

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: '#12 Super Main Event · Flight A', venue: 'Baha Mar', currency: '$', startedAt: 0, breaks: [],
    buyIn: 26000, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', level: 1, tableSize: 8, stack: 60000,
    stackLog: [{ t: 0, stack: 60000, level: 1 }], roster: [], notes: '',
    ...over,
  };
}

test('bag then Day 2: one session, bagged stack carried over, the night is not time played', () => {
  const d1 = bagDay(mk({ breaks: [{ start: 5 * H }] }), 185000, 10 * H);
  assert.equal(isBagged(d1), true);
  assert.equal(d1.endedAt, 10 * H);
  assert.equal(d1.breaks[0].end, 10 * H);
  assert.equal(playedMs(d1), 5 * H);

  const d2 = resumeDay(d1, 36 * H);
  assert.equal(isBagged(d2), false);
  assert.equal(d2.endedAt, undefined);
  assert.equal(d2.bag, undefined);
  assert.equal(dayOf(d2), 2);
  assert.equal(d2.stack, 185000);
  assert.equal(playedMs(d2, 40 * H), 9 * H);
  // The buy-in is still one buy-in.
  assert.equal(cost(d2), 26000);
});

test('result and tournament count are counted once across days', () => {
  const done = { ...resumeDay(bagDay(mk(), 185000, 10 * H), 36 * H), endedAt: 44 * H, cashOut: 90000, finish: 12 };
  const tt = totals([done]);
  assert.equal(tt.sessions, 1);
  assert.equal(tt.profit, 64000);
  assert.equal(tt.itm, 100);
  assert.equal(profit(done), 64000);
});

test('while bagged it reads as the buy-in spent, and resuming twice is harmless', () => {
  const d1 = bagDay(mk(), 185000, 10 * H);
  assert.equal(profit(d1), -26000);
  const d2 = resumeDay(d1, 36 * H);
  assert.deepEqual(resumeDay(d2, 37 * H), d2);
});

test('bust Flight A, enter Flight B: a re-entry on the same session', () => {
  const busted = { ...mk(), endedAt: 4 * H, stack: 0 };
  const b = reenterFlight(busted, '#12 Super Main Event · Flight B', 50 * H);
  assert.equal(b.endedAt, undefined);
  assert.equal(b.entries, 2);
  assert.equal(b.stack, 60000);
  assert.equal(b.name, '#12 Super Main Event · Flight B');
  assert.equal(cost(b), 52000);
  assert.equal(playedMs(b, 54 * H), 8 * H);
});
