/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WSOP_PARADISE_2026 as F } from '../../poker/festivals';
import { EMPTY_PLAN } from '../festival-plan';
import { currentTrip, toTripCurrency, tripFromFestival, tripSessions, tripsIn, tripSummary } from '../trip-math';
import type { Session, Trip } from '../types';

const H = 3600000;
const DAY = 24 * H;
const T0 = new Date(2026, 11, 3).getTime();

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: 'Baha Mar', currency: '$', startedAt: T0 + 12 * H, endedAt: T0 + 18 * H, breaks: [],
    buyIn: 1000, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

const trip: Trip = {
  id: 'tr', name: 'Bahamas', venue: 'Baha Mar', currency: '$', from: T0, to: T0 + 5 * DAY - 1,
  fx: { currency: '€', rate: 0.9 },
  expenses: [
    { id: 'e1', kind: 'flight', amount: 900, currency: '€', at: T0, note: '' },
    { id: 'e2', kind: 'hotel', amount: 1500, currency: '$', at: T0, note: '' },
    { id: 'e3', kind: 'food', amount: 50, currency: '£', at: T0, note: '' },
  ],
  createdAt: 0,
};

test('tripSessions: finished sessions started during the trip only', () => {
  const list = [
    mk({ id: 'in', cashOut: 6000 }),
    mk({ id: 'before', startedAt: T0 - H, endedAt: T0 + H }),
    mk({ id: 'after', startedAt: T0 + 5 * DAY, endedAt: T0 + 5 * DAY + H }),
    mk({ id: 'running', endedAt: undefined }),
  ];
  assert.deepEqual(tripSessions(trip, list).map((s) => s.id), ['in']);
});

test('toTripCurrency converts the fx currency at the typed rate and refuses others', () => {
  assert.equal(toTripCurrency(100, '$', trip), 100);
  assert.equal(toTripCurrency(900, '€', trip), 1000);
  assert.equal(toTripCurrency(50, '£', trip), null);
  assert.equal(toTripCurrency(90, '€', { currency: '$' }), null);
});

test('tripSummary: poker minus expenses, by kind, converted, unconvertible left out', () => {
  const s = tripSummary(trip, [mk({ id: 'a', cashOut: 6000 }), mk({ id: 'b', cashOut: 0 }), mk({ id: 'c', currency: '£', cashOut: 500 })]);
  assert.equal(s.sessions, 2);
  assert.equal(s.poker, 5000 - 1000);
  assert.equal(s.byKind.flight, 1000);
  assert.equal(s.byKind.hotel, 1500);
  assert.equal(s.expenses, 2500);
  assert.equal(s.net, 4000 - 2500);
  assert.equal(s.hours, 12);
  assert.equal(s.days, 5);
  assert.deepEqual(s.skipped, [{ currency: '£', sessions: 1, expenses: 1 }]);
  assert.ok(s.converted);
  assert.equal(s.converted!.currency, '€');
  assert.ok(Math.abs(s.converted!.net - 1350) < 1e-9);
});

test('tripSummary without a rate keeps only the trip currency', () => {
  const s = tripSummary({ ...trip, fx: undefined }, [mk({ cashOut: 2000 })]);
  assert.equal(s.converted, null);
  assert.equal(s.expenses, 1500);
  assert.equal(s.net, 1000 - 1500);
});

test('tripsIn and currentTrip', () => {
  const other: Trip = { ...trip, id: 'old', from: T0 - 40 * DAY, to: T0 - 35 * DAY };
  assert.deepEqual(tripsIn([other, trip], { from: T0 + DAY }).map((x) => x.id), ['tr']);
  assert.deepEqual(tripsIn([other, trip], {}).map((x) => x.id), ['tr', 'old']);
  assert.equal(currentTrip([other, trip], T0 + 2 * DAY)?.id, 'tr');
  assert.equal(currentTrip([other, trip], T0 + 10 * DAY), null);
});

test('tripFromFestival spans the planned events plus a travel day each side', () => {
  const plan = { ...EMPTY_PLAN, picked: ['4-A', '12-A'] };
  const x = tripFromFestival('t', F, plan, { currency: '€', rate: 0.9 });
  assert.equal(x.currency, '$');
  assert.equal(x.festivalId, F.id);
  assert.equal(new Date(x.from).getDate(), 4);
  assert.equal(new Date(x.to).getDate(), 11);
  const all = tripFromFestival('t', F, EMPTY_PLAN);
  assert.equal(new Date(all.from).getDate(), 1);
  assert.equal(new Date(all.to).getDate(), 18);
});
