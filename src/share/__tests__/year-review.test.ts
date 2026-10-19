/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import type { Session } from '../../store/types';
import { defaultYear, reviewYears, yearCards, yearReview } from '../year-review';

const H = 3_600_000;
const D = 24 * H;
const at = (y: number, m: number, d: number) => new Date(y, m, d, 20).getTime();
let n = 0;
function mk(over: Partial<Session> = {}): Session {
  const startedAt = over.startedAt ?? at(2026, 2, 1);
  return {
    id: 's' + n++, kind: 'cash', name: '', venue: 'Estoril', currency: '€', startedAt, endedAt: startedAt + 4 * H, breaks: [],
    buyIn: 1000, entries: 1, addOn: 0, cashOut: 1000, sb: 5, bb: 10, ante: 0, anteType: 'none', tableSize: 9, stack: 1000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('hours, sessions, venues and countries of the year only', () => {
  const list = [
    mk({ venue: 'Estoril', country: 'PT' }),
    mk({ venue: 'Estoril', country: 'PT', startedAt: at(2026, 3, 1) }),
    mk({ venue: 'Baha Mar', country: 'BS', startedAt: at(2026, 11, 3) }),
    mk({ venue: 'Old', startedAt: at(2025, 5, 1) }),
    mk({ endedAt: undefined, startedAt: at(2026, 9, 1) }),
  ];
  const r = yearReview(2026, list, []);
  assert.equal(r.sessions, 3);
  assert.equal(r.hours, 12);
  assert.equal(r.venues, 2);
  assert.equal(r.topVenue, 'Estoril');
  assert.deepEqual(r.countries, ['PT', 'BS']);
});

test('best session and biggest tournament prize, in the main currency', () => {
  const list = [
    mk({ cashOut: 2500 }),
    mk({ cashOut: 500 }),
    mk({ kind: 'mtt', buyIn: 5300, cashOut: 41000, finish: 7, field: 812, name: 'Main Event' }),
    mk({ currency: '$', cashOut: 900000 }),
  ];
  const r = yearReview(2026, list, []);
  assert.equal(r.currency, '€');
  assert.equal(r.best?.profit, 35700);
  assert.equal(r.score?.prize, 41000);
  assert.equal(r.profit, 1500 - 500 + 35700);
});

test('stakes need two sessions and three hours; best and worst by hourly', () => {
  const list = [
    mk({ sb: 5, bb: 10, cashOut: 1400 }),
    mk({ sb: 5, bb: 10, cashOut: 1200 }),
    mk({ sb: 10, bb: 25, buyIn: 2500, cashOut: 1500 }),
    mk({ sb: 10, bb: 25, buyIn: 2500, cashOut: 2000 }),
    mk({ sb: 25, bb: 50, buyIn: 5000, cashOut: 20000 }),
  ];
  const r = yearReview(2026, list, []);
  assert.equal(r.stakes.length, 2, 'one session at 25/50 is not enough');
  assert.equal(r.bestStake?.key, 'cash|5/10');
  assert.equal(r.bestStake?.hourly, 75);
  assert.equal(r.bestStake?.bbPerHour, 7.5);
  assert.equal(r.worstStake?.key, 'cash|10/25');
  assert.equal(r.hourly, (600 - 1500 + 15000) / 20);
});

test('biggest pot of the year and the longest logging streak', () => {
  const h = { ...sampleHand('a'), createdAt: at(2026, 4, 1) };
  const old = { ...sampleHand('b'), createdAt: at(2025, 4, 1) };
  const w0 = at(2026, 0, 5); // a Monday
  const activity = [w0, w0 + 7 * D, w0 + 14 * D, w0 + 35 * D, w0 + 42 * D];
  const r = yearReview(2026, [mk()], [h, old], activity);
  assert.equal(r.pot?.hand.id, h.id);
  assert.equal(r.hands, 1);
  assert.equal(r.streak, 3);
  assert.equal(r.weeksLogged, 5);
  // A pause over the missing weeks keeps the run going.
  const paused = yearReview(2026, [mk()], [], activity, [{ from: w0 + 21 * D, to: w0 + 35 * D }]);
  assert.equal(paused.streak, 5);
});

test('cards with nothing real to show are left out', () => {
  const r = yearReview(2026, [mk({ cashOut: 0 }), mk({ cashOut: 0, startedAt: at(2026, 5, 1) })], []);
  // Two losing months: no best month, but the fall is real, so the bankroll card stays.
  assert.deepEqual(yearCards(r), ['year', 'stakes', 'bankroll']);
  assert.deepEqual(yearCards(yearReview(2026, [mk({ cashOut: 0 }), mk({ cashOut: 0 })], [])), ['year', 'stakes']);
});

test('months, best month and the deepest fall of the year', () => {
  const list = [
    mk({ startedAt: at(2025, 11, 20), cashOut: 9000 }), // last year: not counted
    mk({ startedAt: at(2026, 0, 5), cashOut: 2000 }), // +1000
    mk({ startedAt: at(2026, 1, 5), cashOut: 0 }), // −1000
    mk({ startedAt: at(2026, 1, 9), cashOut: 500 }), // −500: 1500 under the high
    mk({ startedAt: at(2026, 3, 2), cashOut: 3000 }), // +2000: back above it
    mk({ startedAt: at(2026, 3, 9), cashOut: 1500 }), // +500
  ];
  const r = yearReview(2026, list, []);
  assert.equal(r.months.length, 12);
  assert.deepEqual(r.months.slice(0, 4).map((m) => m.profit), [1000, -1500, 0, 2500]);
  assert.deepEqual(r.bestMonth, { month: 3, profit: 2500 });
  assert.equal(r.downswing!.depth, 1500);
  assert.equal(r.downswing!.sessions, 2);
  assert.equal(r.downswing!.recovered, list[4].endedAt);
  assert.ok(yearCards(r).includes('bankroll'));
});

test('opens on last year through January, otherwise this year', () => {
  const list = [0, 1, 2].map((i) => mk({ startedAt: at(2025, 3 + i, 1) }));
  assert.equal(defaultYear(list, at(2026, 0, 10)), 2025);
  assert.equal(defaultYear(list, at(2026, 5, 10)), 2025, 'falls back to last year when this one has too little');
  assert.equal(defaultYear(list.slice(0, 2), at(2026, 0, 10)), null);
  assert.deepEqual(reviewYears([...list, mk()]), [2026, 2025]);
});

test('the week map covers every week of the year', () => {
  const r = yearReview(2026, [mk()], [], [at(2026, 0, 5)]);
  assert.ok(r.weekMap.length === 52 || r.weekMap.length === 53);
  assert.equal(r.weekMap[0], true);
  assert.equal(r.weekMap.filter(Boolean).length, 1);
});
