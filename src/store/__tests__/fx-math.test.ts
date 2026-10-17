/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { eurRate, homeTotals, mergeRates, rate, type RateTable } from '../fx-math';
import type { Bankroll, Session, Transfer } from '../types';

const table: RateTable = {
  '2026-01-02': { USD: 1.1, GBP: 0.85 },
  '2026-01-05': { USD: 1.2, GBP: 0.86 },
  '2026-06-01': { USD: 1.25 },
};
const at = (m: number, d: number) => new Date(2026, m, d, 20).getTime();

test('eurRate: the day, else the last day before, else the first after', () => {
  assert.equal(eurRate(table, 'USD', '2026-01-02'), 1.1);
  assert.equal(eurRate(table, 'USD', '2026-01-04'), 1.1);
  assert.equal(eurRate(table, 'USD', '2026-03-01'), 1.2);
  assert.equal(eurRate(table, 'USD', '2025-12-01'), 1.1);
  assert.equal(eurRate(table, 'GBP', '2026-07-01'), 0.86);
  assert.equal(eurRate(table, 'EUR', '2026-07-01'), 1);
  assert.equal(eurRate(table, 'HKD', '2026-07-01'), null);
});

test('rate between symbols goes through EUR', () => {
  assert.equal(rate(table, '$', '€', at(0, 5)), 1 / 1.2);
  assert.ok(Math.abs(rate(table, '$', '£', at(0, 5))! - 0.86 / 1.2) < 1e-12);
  assert.equal(rate(table, '€', '€', 0), 1);
  assert.equal(rate(table, 'HK$', '€', at(0, 5)), null);
  assert.equal(rate(table, '?', '€', at(0, 5)), null);
});

const mk = (o: Partial<Session>): Session => ({
  id: 's', kind: 'cash', name: '', venue: '', currency: '€', startedAt: at(0, 5), endedAt: at(0, 5) + 3600000, breaks: [], buyIn: 100, entries: 1, addOn: 0, cashOut: 100,
  sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...o,
});

test('homeTotals: each session at its own day, net worth at the latest rate, unknown currencies listed', () => {
  const bankrolls: Bankroll[] = [
    { id: 'e', name: 'EUR', currency: '€', createdAt: 1 },
    { id: 'u', name: 'USD', currency: '$', createdAt: 2 },
    { id: 'h', name: 'HKD', currency: 'HK$', createdAt: 3 },
  ];
  const sessions = [
    mk({ id: 'a', cashOut: 200 }),
    mk({ id: 'b', currency: '$', bankrollId: 'u', cashOut: 340 }),
    mk({ id: 'c', currency: '$', bankrollId: 'u', kind: 'mtt', buyIn: 1250, cashOut: 0, startedAt: at(5, 1), endedAt: at(5, 1) + 3600000 }),
    mk({ id: 'd', currency: 'HK$', bankrollId: 'h', cashOut: 500 }),
    mk({ id: 'old', startedAt: at(0, 5) - 400 * 86400000, endedAt: at(0, 5) - 400 * 86400000 + 1 }),
  ];
  const transfers: Transfer[] = [{ id: 't', bankrollId: 'u', kind: 'deposit', amount: 2500, at: at(0, 1), note: '' }];
  const h = homeTotals({ sessions, transfers, bankrolls }, '€', table, { from: new Date(2026, 0, 1).getTime() }, at(9, 1));
  // 100 € + 240 $ at 1.2 + −1250 $ at 1.25.
  assert.ok(Math.abs(h.profit - (100 + 200 - 1000)) < 1e-9);
  assert.equal(h.sessions, 3);
  assert.equal(h.roi, -100);
  // € bankroll: +100 +0 (old session) ; $ bankroll: 2500 + 240 − 1250 = 1490 $ at 1.25.
  assert.ok(Math.abs(h.netWorth - (100 + 1490 / 1.25)) < 1e-9);
  assert.deepEqual(h.missing, ['HK$']);
  assert.equal(h.mixed, true);
});

test('mergeRates takes a time series or one day, ignores junk and other bases', () => {
  let t: RateTable = {};
  t = mergeRates(t, { amount: 1, base: 'EUR', start_date: '2026-01-02', end_date: '2026-01-05', rates: { '2026-01-02': { USD: 1.1 }, '2026-01-05': { USD: 1.2, GBP: 'x' } } });
  assert.deepEqual(t, { '2026-01-02': { USD: 1.1 }, '2026-01-05': { USD: 1.2 } });
  t = mergeRates(t, { amount: 1, base: 'EUR', date: '2026-01-06', rates: { USD: 1.3 } });
  assert.equal(t['2026-01-06'].USD, 1.3);
  assert.equal(mergeRates(t, { base: 'USD', rates: { '2026-01-07': { EUR: 1 } } }), t);
  assert.equal(mergeRates(t, 'nope'), t);
});
