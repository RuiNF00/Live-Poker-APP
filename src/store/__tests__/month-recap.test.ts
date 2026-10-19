/// <reference types="node" />
// A real October: cash at 1/2 and 2/5 plus a tournament, checked by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareMonths, defaultMonth, monthKey, monthRecap, nextRecap, prevKey, recapMonths, recapNotice } from '../month-recap';
import type { Session } from '../types';

const H = 3600000;
let n = 0;
function s(month: number, day: number, hours: number, result: number, over: Partial<Session> = {}): Session {
  const start = new Date(2026, month, day, 20).getTime();
  return {
    id: 'm' + n++, kind: 'cash', name: 'NLH 2/5', venue: 'Casino Estoril', currency: '€', startedAt: start, endedAt: start + hours * H, breaks: [],
    buyIn: 500, entries: 1, addOn: 0, cashOut: 500 + result, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
  };
}

// October 2026: 2/5 for 6 h +600 (120 bb), 1/2 for 4 h −80 (−40 bb), a 1 100 € tournament for 8 h that pays 2 300.
// Cash: 80 bb in 10 h = 8 BB/h. All: 600 − 80 + 1 200 = 1 720 in 18 h.
const oct = [
  s(9, 3, 6, 600),
  s(9, 10, 4, -80, { name: 'NLH 1/2', sb: 1, bb: 2, buyIn: 200, cashOut: 120, venue: 'Casino Lisboa' }),
  s(9, 18, 8, 1200, { kind: 'mtt', name: 'Main Event', buyIn: 1100, cashOut: 2300, sb: 0, bb: 0 }),
];
// Earlier months: September +200 in 10 h, July −300 in 5 h (August empty).
const before = [s(8, 5, 10, 200), s(6, 20, 5, -300)];
const all = [...oct, ...before, s(9, 25, 3, 50, { currency: '$', venue: 'Las Vegas' })];

test('the month adds up in its own currency', () => {
  const r = monthRecap(all, '2026-10');
  assert.equal(r.currency, '€');
  assert.equal(r.sessions, 3);
  assert.equal(r.hours, 18);
  assert.equal(r.profit, 1720);
  assert.equal(Math.round(r.hourly * 100) / 100, 95.56);
  assert.equal(r.bbHourly, 8);
  assert.equal(r.mtts, 1);
  assert.equal(r.cashes, 1);
  assert.equal(r.best!.profit, 1200);
  assert.equal(r.worst!.profit, -80);
  assert.equal(r.venues, 2);
  assert.equal(monthRecap(all, '2026-10', '$').profit, 50);
});

test('no BB/h from a few cash minutes', () => {
  // A 1-minute 1/2 session at −200 would be −6 000 BB/h: under 3 cash hours there is no rate.
  const r = monthRecap([...oct, s(9, 20, 1 / 60, -200, { sb: 1, bb: 2, buyIn: 200, cashOut: 0 })], '2026-10');
  // With 10 cash hours the minute just counts in: (80 − 100) bb in 10 h ≈ −2 BB/h.
  assert.equal(Math.round(r.bbHourly! * 100) / 100, -2);
  const tiny = monthRecap([s(9, 20, 1 / 60, -200, { sb: 1, bb: 2, buyIn: 200, cashOut: 0 })], '2026-10');
  assert.equal(tiny.bbHourly, null);
  assert.equal(tiny.cashSessions, 1);
});

test('months, defaults and the year boundary', () => {
  assert.deepEqual(recapMonths(all), ['2026-10', '2026-09', '2026-07']);
  assert.equal(prevKey('2026-01'), '2025-12');
  assert.equal(monthKey(new Date(2026, 11, 31, 23, 59).getTime()), '2026-12');
  // Mid-October the default is September; in November it is October.
  assert.equal(defaultMonth(all, new Date(2026, 9, 20).getTime()), '2026-09');
  assert.equal(defaultMonth(all, new Date(2026, 10, 2).getTime()), '2026-10');
  assert.equal(defaultMonth([], Date.now()), null);
});

test('comparison with the months before', () => {
  const c = compareMonths(all, '2026-10', '€');
  assert.deepEqual(c.history.map((h) => h.key), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.equal(c.prev!.profit, 200);
  // July and September: −50 a month on average, 7.5 h a month, −100 in 15 h.
  assert.equal(c.avg!.months, 2);
  assert.equal(c.avg!.profit, -50);
  assert.equal(c.avg!.hours, 7.5);
  assert.equal(Math.round(c.avg!.hourly * 100) / 100, -6.67);
  assert.equal(c.rank, 1);
  assert.equal(c.of, 3);
  const sep = compareMonths(all, '2026-09', '€');
  assert.equal(sep.prev, null);
  assert.equal(sep.rank, 1);
});

test('the notification on the 1st, and privacy mode', () => {
  const r = monthRecap(all, '2026-10');
  const open = recapNotice(r, false);
  // A month with a tournament gives money, never a cash-only BB/h next to it.
  assert.match(open.title, /: 18 h, \+1[ .\u00a0\u202f]?720/);
  assert.doesNotMatch(open.title, /BB/);
  // An all-cash month gives BB/h.
  assert.match(recapNotice(monthRecap(before, '2026-09'), false).title, /: 10 h, \+4 BB\/h$/);
  assert.match(open.body, /\+1200€|\+1\.200€|\+1 200€/);
  assert.match(open.body, /Casino Estoril/);
  const priv = recapNotice(r, true);
  assert.match(priv.title, /18 h em 3 sessões$/);
  assert.doesNotMatch(priv.title + priv.body, /€|BB|\d{3}/);
  // Tournaments only: no BB/h, the result instead.
  const mtt = recapNotice(monthRecap([oct[2]], '2026-10'), false);
  assert.match(mtt.title, /: 8 h, \+1/);
});

test('next recap: the 1st at 13:00, for the month just finished', () => {
  const mid = nextRecap(new Date(2026, 9, 17, 15).getTime());
  assert.equal(mid.at, new Date(2026, 10, 1, 13).getTime());
  assert.equal(mid.key, '2026-10');
  // Early on the 1st, it is still today.
  const early = nextRecap(new Date(2026, 10, 1, 8).getTime());
  assert.equal(early.at, new Date(2026, 10, 1, 13).getTime());
  assert.equal(early.key, '2026-10');
  const dec = nextRecap(new Date(2026, 11, 5).getTime());
  assert.equal(dec.key, '2026-12');
  assert.equal(new Date(dec.at).getFullYear(), 2027);
});
