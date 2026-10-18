/// <reference types="node" />
// Real cases checked by hand: the win rate, its spread and the 95% interval
// must be exactly what a player could work out on paper.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { totals } from '../session-math';
import type { Session } from '../types';
import { gameOf, hoursToKnow, winRate, winRateBy } from '../winrate-math';

const H = 3600000;
const r2 = (n: number) => Math.round(n * 100) / 100;
let n = 0;
function cash(day: number, hours: number, result: number, over: Partial<Session> = {}): Session {
  const start = new Date(2026, 8, day, 20).getTime();
  return {
    id: 'w' + n++, kind: 'cash', name: 'NLH 2/5', venue: 'Casino Estoril', currency: '€', startedAt: start, endedAt: start + hours * H, breaks: [],
    buyIn: 500, entries: 1, addOn: 0, cashOut: 500 + result, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
  };
}

// Four 5-hour sessions at 2/5: +500, −100, +300, −300. 400 in 20 h = 20 €/h.
// Off the rate: +400, −200, +200, −400 → squares sum to 400 000; ÷ 20 h = 20 000 → σ = 141.42 €/h.
// σ/√20 = 31.62 → 95%: 20 ± 61.98.
const four = [cash(1, 5, 500), cash(3, 5, -100), cash(5, 5, 300), cash(7, 5, -300)];

test('hourly, spread and 95% interval match the hand calculation', () => {
  const w = winRate(four)!;
  assert.equal(w.hourly, 20);
  assert.equal(r2(w.sd), 141.42);
  assert.equal(r2(w.lo), -41.98);
  assert.equal(r2(w.hi), 81.98);
  assert.equal(w.small, true, '20 h is a small sample');
  // Same hourly as the Bankroll totals.
  assert.equal(w.hourly, totals(four, '€').hourly);
});

test('BB/h uses each session\'s own blinds', () => {
  const w = winRate(four)!;
  assert.equal(w.bbHourly, 4);
  assert.equal(r2(w.sdBb), 28.28);
  // A 1/2 session next to 2/5: +200 at 1/2 is +100 BB, +500 at 2/5 is +100 BB too.
  const mixed = winRate([cash(1, 5, 200, { sb: 1, bb: 2 }), cash(2, 5, 500), cash(3, 5, 500)])!;
  assert.equal(mixed.bbHourly, 20);
});

test('hours to know: (1.96 × σ_BB / 5)²', () => {
  const k = hoursToKnow(winRate(four)!);
  // (1.96 × 28.284 / 5)² = 122.9 → 123 h; 103 still to play, about 21 sessions of 5 h.
  assert.equal(k.needed, 123);
  assert.equal(k.left, 103);
  assert.equal(k.sessions, 21);
  assert.equal(r2(k.margin), 12.4);
  assert.equal(hoursToKnow({ ...winRate(four)!, hours: 500 }).left, 0);
});

test('breakdowns by game, stake, venue and weekday', () => {
  const list = [...four, cash(2, 4, 600, { name: 'PLO 2/5', venue: 'Casino Lisboa' }), cash(4, 4, -200, { name: 'PLO 2/5', venue: 'Casino Lisboa' })];
  const games = winRateBy(list, 'game', '€');
  assert.deepEqual(games.map((g) => g.label), ['NLH', 'PLO']);
  assert.equal(games[1].w.hourly, 50);
  assert.deepEqual(winRateBy(list, 'venue', '€').map((g) => g.label), ['Casino Estoril', 'Casino Lisboa']);
  assert.deepEqual(winRateBy(list, 'stake', '€').map((g) => g.label), ['2/5']);
  assert.ok(winRateBy(list, 'weekday', '€').every((g) => g.w.sessions >= 2), 'single-session days are left out');
  assert.equal(winRate(four.slice(0, 2)), null, 'needs 3 sessions');
  assert.equal(gameOf(cash(1, 1, 0, { name: 'Omaha hi-lo' })), 'PLO');
});

// A 3-minute session at +200 would read as +4000 €/h: no rate under MIN_RATE_HOURS (15 min) of play.
test('no win rate from a few minutes of play, but the minutes still count', () => {
  const blips = [cash(10, 0.05, 200), cash(11, 0.05, -50), cash(12, 0.05, 100)];
  assert.equal(winRate(blips), null, '9 minutes in all');
  const tiny = winRateBy([cash(13, 0.05, 200, { venue: 'Póker Lisboa' }), cash(14, 0.05, 100, { venue: 'Póker Lisboa' }), ...four], 'venue', '€');
  assert.deepEqual(tiny.map((g) => g.label), ['Casino Estoril'], 'a group of two 3-minute sessions shows no rate');
  // Mixed in with real hours, the short session's money and time are kept.
  const w = winRate([...four, blips[0]])!;
  assert.equal(r2(w.hours), 20.05);
  assert.equal(w.hourly, 600 / w.hours);
  const tt = totals([...four, blips[0]], '€');
  assert.equal(tt.profit, 600);
  assert.equal(r2(tt.hours), 20.05);
});
