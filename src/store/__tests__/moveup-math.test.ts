/// <reference types="node" />
// "Posso subir de stake?": buy-ins, risk of ruin and a shot, checked by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buyInsForRisk, currentStake, moveUp, nextStake, riskOfRuin, shotState, usualMttBuyIn, withdrawable } from '../moveup-math';
import type { Session, ShotPlan } from '../types';

const H = 3600000;
const DAY = 86400000;
const NOW = new Date(2026, 9, 17, 12).getTime();
let n = 0;
function cash(daysAgo: number, hours: number, result: number, sb = 2, bb = 5): Session {
  const start = NOW - daysAgo * DAY;
  return {
    id: 'u' + n++, kind: 'cash', name: `NLH ${sb}/${bb}`, venue: 'Casino Estoril', currency: '€', startedAt: start, endedAt: start + hours * H, breaks: [],
    buyIn: bb * 100, entries: 1, addOn: 0, cashOut: bb * 100 + result, sb, bb, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '',
  };
}

test('the stake played most lately, and the next one up', () => {
  // 10 h of 2/5 and 6 h of 1/2 in the last 90 days; 20 h of 5/10 four months ago don't count.
  const list = [cash(5, 6, 100), cash(12, 4, -50), cash(20, 6, 40, 1, 2), cash(120, 20, 900, 5, 10)];
  assert.deepEqual(currentStake(list, NOW), { sb: 2, bb: 5 });
  assert.deepEqual(currentStake([cash(120, 20, 900, 5, 10)], NOW), { sb: 5, bb: 10 });
  assert.equal(currentStake([], NOW), null);
  assert.deepEqual(nextStake({ sb: 2, bb: 5 }), { sb: 5, bb: 10 });
  assert.deepEqual(nextStake({ sb: 1, bb: 3 }), { sb: 2, bb: 5 });
  assert.equal(nextStake({ sb: 500, bb: 1000 }), null);
});

test('buy-ins now and for the next stake against a 30 buy-in rule', () => {
  // 21 000 € is 42 buy-ins of 2/5 (500) and 21 of 5/10 (1000); the rule asks 30 000 for 5/10.
  const m = moveUp(21000, { sb: 2, bb: 5 }, { cashBuyIns: 30 });
  assert.equal(m.curBuyIns, 42);
  assert.equal(m.nextBuyIns, 21);
  assert.equal(m.need, 30000);
  assert.equal(m.ready, false);
  assert.equal(m.missing, 9000);
  assert.equal(moveUp(30000, { sb: 2, bb: 5 }, { cashBuyIns: 30 }).ready, true);
});

test('risk of ruin from the player own win rate', () => {
  // +8 BB/h with σ 80 BB/h. At 2/5: μ 40 €/h, σ 400 €/h → exp(−2·40·21000/160000) = exp(−10.5).
  const w = { bbHourly: 8, sdBb: 80 };
  assert.equal(riskOfRuin(21000, { sb: 2, bb: 5 }, w), Math.exp(-10.5));
  // At 5/10 the same bankroll is half as deep: exp(−5.25) ≈ 0.5%.
  assert.equal(Math.round(riskOfRuin(21000, { sb: 5, bb: 10 }, w) * 10000) / 10000, 0.0052);
  // 5% risk: 80²·ln 20 / (2·8) = 1198 BB ≈ 12 buy-ins.
  assert.equal(Math.round(buyInsForRisk(0.05, w)! * 10) / 10, 12);
  // Not winning: ruin is certain in the long run, and no bankroll is enough.
  assert.equal(riskOfRuin(21000, { sb: 2, bb: 5 }, { bbHourly: -2, sdBb: 80 }), 1);
  assert.equal(buyInsForRisk(0.05, { bbHourly: 0, sdBb: 80 }), null);
  assert.equal(riskOfRuin(0, { sb: 2, bb: 5 }, w), 1);
});

test('a shot: 5 buy-ins at 5/10, back to 2/5 after losing 2', () => {
  const plan: ShotPlan = { sb: 5, bb: 10, buyIns: 5, stopAfter: 2, back: { sb: 2, bb: 5 }, startedAt: NOW - 10 * DAY };
  // Before the plan and at other stakes: not counted.
  const base = [cash(30, 5, -2000, 5, 10), cash(3, 5, -400)];
  const a = shotState(plan, [...base, cash(8, 5, -1500, 5, 10), cash(6, 5, 300, 5, 10)]);
  assert.equal(a.net, -1200);
  assert.equal(a.lostBuyIns, 1.2);
  assert.equal(Math.round(a.left * 10) / 10, 0.8);
  assert.equal(a.over, false);
  assert.equal(a.sessions, 2);
  const b = shotState(plan, [...base, cash(8, 5, -1500, 5, 10), cash(6, 5, 300, 5, 10), cash(2, 5, -900, 5, 10)]);
  assert.equal(b.over, true);
  assert.equal(b.left, 0);
  const up = shotState(plan, [cash(8, 5, 2500, 5, 10)]);
  assert.equal(up.lostBuyIns, 0);
  assert.equal(up.left, 2);
});

function mtt(daysAgo: number, buyIn: number): Session {
  return { ...cash(daysAgo, 6, -buyIn), kind: 'mtt', buyIn, cashOut: 0, sb: 0, bb: 0 };
}

test('how much can come out and still keep the rules', () => {
  const rules = { cashBuyIns: 30, mttBuyIns: 100 };
  // 2/5 at 30 buy-ins wants 15 000; 21 000 leaves 6 000 free.
  const k = withdrawable(21000, [cash(5, 6, 100)], rules, NOW)!;
  assert.equal(k.need, 15000);
  assert.equal(k.free, 6000);
  assert.deepEqual(k.basis, { kind: 'cash', stake: { sb: 2, bb: 5 }, buyIns: 30 });
  // At or under the rule: nothing free, never negative.
  assert.equal(withdrawable(12000, [cash(5, 6, 100)], rules, NOW)!.free, 0);
  // Tournaments: median buy-in 250 × 100 = 25 000 beats the cash need.
  const list = [cash(5, 6, 100), mtt(3, 200), mtt(4, 250), mtt(6, 1100)];
  assert.equal(usualMttBuyIn(list, NOW), 250);
  const m = withdrawable(30000, list, rules, NOW)!;
  assert.equal(m.need, 25000);
  assert.equal(m.free, 5000);
  assert.deepEqual(m.basis, { kind: 'mtt', buyIn: 250, buyIns: 100 });
  // Nothing played: no answer.
  assert.equal(withdrawable(30000, [], rules, NOW), null);
});
