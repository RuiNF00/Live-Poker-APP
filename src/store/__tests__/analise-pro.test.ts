/// <reference types="node" />
// The Pro analysis numbers checked against hand calculations and what a
// simulation of thousands of players says they should be: the spread per hour,
// the 95% range from a few sessions, the hours still to play, the tournament
// verdict and whether an insight is more than luck.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { teasers } from '../../billing/teasers';
import { insights } from '../insights-math';
import { mttStats, tourneySpread, verdict } from '../results-math';
import { sdPerHour, t95 } from '../spread-math';
import type { Session } from '../types';
import { hoursToKnow, winRate } from '../winrate-math';

const H = 3600000;
const r2 = (n: number) => Math.round(n * 100) / 100;
let n = 0;
function cash(start: number, hours: number, result: number, over: Partial<Session> = {}): Session {
  return {
    id: 'p' + n++, kind: 'cash', name: 'NLH 2/5', venue: 'Casino Estoril', currency: '€', startedAt: start, endedAt: start + hours * H, breaks: [],
    buyIn: 500, entries: 1, addOn: 0, cashOut: 500 + result, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
  };
}
const mtt = (cashOut: number, over: Partial<Session> = {}) => cash(0, 5, 0, { kind: 'mtt', name: 'Daily', buyIn: 100, cashOut, ...over });

test('the spread per hour counts the win rate fitted to the same sessions', () => {
  // Equal sessions: the usual sample standard deviation per session, ÷ √h. 3 × 4 h: +200, −120, +160.
  const xs = [200, -120, 160];
  const mean = 80;
  const perSession = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / 2);
  assert.ok(Math.abs(sdPerHour(xs, [4, 4, 4], 20) - perSession / 2) < 1e-9);
  // It read √(2/3) of that: 18% too small, and the 95% range with it.
  assert.ok(Math.abs(sdPerHour(xs, [4, 4, 4], 20) - Math.sqrt(60800 / 8)) < 1e-9);
  // Unequal sessions: Σ(x − r·h)² / (H − Σh²/H). 2 h +100, 8 h −300, 5 h +350 → 150 in 15 h = 10/h.
  const ss = (100 - 20) ** 2 + (-300 - 80) ** 2 + (350 - 50) ** 2;
  assert.ok(Math.abs(sdPerHour([100, -300, 350], [2, 8, 5], 10) - Math.sqrt(ss / (15 - 93 / 15))) < 1e-9);
  // A session with no time adds nothing; one session alone has no spread to read.
  assert.equal(sdPerHour([100, 50], [2, 0], 50), 0);
});

test('the 95% range from a few sessions uses Student\'s t, not 1.96', () => {
  assert.deepEqual([t95(2), t95(3), t95(4), t95(11), t95(31)], [12.706, 4.303, 3.182, 2.228, 2.042]);
  assert.ok(Math.abs(t95(200) - 1.972) < 0.001);
  // 3 sessions of 4 h: +200, −120, +160 → 20 €/h, σ = 87.18 €/h, ±4.303 × 87.18/√12 = ±108.29.
  const w = winRate([cash(0, 4, 200), cash(1e8, 4, -120), cash(2e8, 4, 160)])!;
  assert.equal(r2(w.sd), 87.18);
  assert.equal(r2(w.hi - w.hourly), 108.29);
  // In a simulation of 4 000 players with a known win rate, this range held it 95% of the time
  // with 3, 5, 10 and 30 sessions; the old one (÷ H and 1.96) 74%, 83%, 90% and 94%.
});

test('hours still to play count only the hours with blinds', () => {
  // Four 5 h sessions at 2/5, plus 20 h imported without blinds: those aren't BB data.
  const four = [cash(0, 5, 500), cash(1e8, 5, -100), cash(2e8, 5, 300), cash(3e8, 5, -300)];
  const w = winRate([...four, cash(4e8, 20, 200, { sb: 0, bb: 0 })])!;
  assert.equal(w.bbHours, 20);
  const k = hoursToKnow(w);
  assert.equal(k.have, 20);
  // The margin is the BB spread over √20, not √40 (it read 1.4× narrower than it is).
  assert.equal(r2(k.margin), r2((3.182 * w.sdBb) / Math.sqrt(20)));
  // The same margin the BB bar on that screen draws (it said ±1.96·σ while the bar used Student's t).
  assert.equal(r2(k.margin), r2(w.bbHi - w.bbHourly));
  assert.equal(k.left, k.needed - 20);
});

test('tournament ROI error: weighed like the ROI, and never below what fields that size give', () => {
  // Mixed buy-ins, as in a festival week: the ratio estimator, from result − ROI × buy-in.
  const list = [mtt(0), mtt(0), mtt(0), mtt(0), mtt(600), mtt(0, { buyIn: 1000 }), mtt(3000, { buyIn: 1000 }), mtt(0, { buyIn: 1000 })];
  const s = mttStats(list)!;
  const own = 4 * 100 + 100 + 3000;
  const roi = (600 + 3000 - own) / own;
  const ss = list.reduce((a, x) => a + (x.cashOut - x.buyIn - roi * x.buyIn) ** 2, 0);
  assert.ok(Math.abs(s.roi! - roi * 100) < 1e-9);
  const floor = Math.sqrt(list.reduce((a, x) => a + (tourneySpread(200) * x.buyIn) ** 2, 0));
  assert.ok(Math.abs(s.roiSe! - (Math.max(Math.sqrt((ss * 8) / 7), floor) / own) * 100) < 1e-9);
  // A break-even player's spread: about 0.85·∛field buy-ins.
  assert.deepEqual([30, 100, 1000].map((f) => r2(tourneySpread(f))), [2.64, 3.95, 8.5]);
});

test('50 tournaments with min-cashes and no deep run: not yet «já não é azar»', () => {
  // 42 out and 8 min-cashes at 3 buy-ins in fields of 200: ROI −52%. Its own spread is 1.1 buy-ins
  // (no deep run yet), and it said «Perdes nos torneios … já não é azar». In a simulation of
  // break-even players with 50 tournaments, that happened 1 time in 3; now under 1 in 100.
  const list = Array.from({ length: 50 }, (_, i) => mtt(i < 8 ? 300 : 0, { id: 'm' + i, field: 200, startedAt: i * H, endedAt: i * H + 1 }));
  const s = mttStats(list)!;
  assert.equal(Math.round(s.roi!), -52);
  assert.ok(s.sdBuyIns >= tourneySpread(200), 'the calculator projects with the spread of the field');
  assert.equal(s.sdFloored, true, 'and the calculator says it is the floor, not the player\'s own');
  const v = verdict(list, '€', String);
  assert.equal(v.ready, true);
  assert.equal(v.tone, 'neutral', v.text);
  // A clear loser over 300 tournaments still hears it.
  const lots = Array.from({ length: 300 }, (_, i) => mtt(i % 25 === 0 ? 300 : 0, { id: 'l' + i, field: 200, startedAt: i * H, endedAt: i * H + 1 }));
  assert.equal(verdict(lots, '€', String).tone, 'bad');
});

test('an insight within luck says so, and goes after the sure ones', () => {
  const day = (weekday: number, i: number) => new Date(2026, 9, 5 + weekday - 1 + 7 * i, 20).getTime(); // 5 Oct 2026 is a Monday
  // Mondays +25 €/h, Tuesdays −25 €/h over 20 h each, with sessions swinging ±400: within luck.
  const noisy = [
    ...[300, -200, 400, -100, 100].map((r, i) => cash(day(1, i), 4, r)),
    ...[-300, 200, -400, 100, -100].map((r, i) => cash(day(2, i), 4, r)),
  ];
  const a = insights(noisy, String);
  assert.deepEqual(a.map((x) => [x.id, x.sure]), [['weekday', false]]);
  // Before, it read «Perdes dinheiro nas sessões de terça» with nothing to say it can be chance.
  // In a simulation of 400 players whose results depend on nothing, 6% of the cards are now called sure.
  assert.deepEqual(teasers(noisy, '€'), [], 'a pitch never sells a pattern that can still be luck');
  // ±150 €/h with sessions that barely swing: sure.
  const real = [
    ...[600, 500, 700, 550, 650].map((r, i) => cash(day(1, i), 4, r)),
    ...[-600, -500, -700, -550, -650].map((r, i) => cash(day(2, i), 4, r)),
  ];
  const b = insights(real, String);
  assert.deepEqual(b.map((x) => [x.id, x.sure]), [['weekday', true]]);
  assert.equal(teasers(real, '€').length, 1);
});
