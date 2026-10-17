/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { aboveRules, allowedStakes, DEFAULT_RULES, liveResult, stopLoss, targetProgress } from '../rules-math';
import type { Session } from '../types';

const H = 3600000;
const NOW = new Date(2026, 9, 17, 23).getTime();
let n = 0;
function cash(over: Partial<Session> = {}): Session {
  return {
    id: 's' + n++, kind: 'cash', name: 'NLH 2/5', venue: '', currency: '€', startedAt: NOW - 5 * H, endedAt: NOW - H, breaks: [],
    buyIn: 500, entries: 1, addOn: 0, cashOut: 500, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 500, stackLog: [], roster: [], notes: '', ...over,
  };
}

test('30 buy-ins: 15 000 allows 2/5 and points at 5/10', () => {
  const a = allowedStakes(15000, DEFAULT_RULES);
  assert.deepEqual([a.cash?.sb, a.cash?.bb], [2, 5]);
  assert.deepEqual([a.next?.sb, a.next?.bb, a.next?.missing], [5, 10, 15000]);
  assert.equal(a.mttMax, 150);
});

test('below the smallest stake: nothing allowed, missing counts from zero', () => {
  const a = allowedStakes(-200, DEFAULT_RULES);
  assert.equal(a.cash, null);
  assert.equal(a.next?.missing, 6000);
  assert.equal(a.mttMax, 0);
});

test('stakes played above the rules', () => {
  const list = [cash(), cash({ sb: 5, bb: 10 }), cash({ kind: 'mtt', buyIn: 1100 }), cash({ sb: 5, bb: 10, startedAt: NOW - 400 * 24 * H })];
  assert.deepEqual(aboveRules(list, 15000, DEFAULT_RULES, NOW - 90 * 24 * H), ['MTT 1100', '5/10']);
  assert.deepEqual(aboveRules(list, 15000, DEFAULT_RULES, NOW - 90 * 24 * H, (n) => `${n}€`), ['MTT 1100€', '5/10']);
  assert.deepEqual(aboveRules(list, 15000, DEFAULT_RULES, NOW - 90 * 24 * H, () => '•••'), ['MTT •••', '5/10']);
});

test('stop-loss per session uses the live stack', () => {
  const r = { ...DEFAULT_RULES, stopLoss: 1000 };
  const live = cash({ endedAt: undefined, entries: 3, stack: 700 }); // in 1500, has 700
  assert.equal(liveResult(live), -800);
  const sl = stopLoss(r, [], live, NOW)!;
  assert.deepEqual([sl.lost, sl.left, sl.near, sl.hit], [800, 200, true, false]);
  assert.equal(stopLoss(r, [], null, NOW), null);
  assert.equal(stopLoss(DEFAULT_RULES, [], live, NOW), null, 'off when 0');
  // A live tournament has no result yet: registering never trips the stop-loss.
  assert.equal(liveResult({ ...live, kind: 'mtt', buyIn: 5300 }), 0);
});

test('stop-loss per day adds today\'s finished sessions, not yesterday\'s', () => {
  const r = { ...DEFAULT_RULES, stopLoss: 1000, stopLossPer: 'day' as const };
  const today = cash({ cashOut: 0 }); // -500
  const yesterday = cash({ cashOut: 0, startedAt: NOW - 30 * H, endedAt: NOW - 26 * H });
  const live = cash({ endedAt: undefined, stack: 0 }); // -500
  assert.equal(stopLoss(r, [today, yesterday], live, NOW)!.hit, true);
  assert.equal(stopLoss(r, [today, yesterday], null, NOW)!.lost, 500);
  const up = cash({ cashOut: 2000 });
  assert.equal(stopLoss(r, [today, up], null, NOW)!.lost, 0, 'ahead on the day');
});

test('target progress', () => {
  assert.equal(targetProgress({ ...DEFAULT_RULES, target: 20000 }, 15000), 0.75);
  assert.equal(targetProgress({ ...DEFAULT_RULES, target: 20000 }, 25000), 1);
  assert.equal(targetProgress(DEFAULT_RULES, 15000), null);
});
