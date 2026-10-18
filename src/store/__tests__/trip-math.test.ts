/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BAHAMAS_DEC_2026 as F, BAHIA_JAN_2027 } from '../../poker/festivals';
import { SAO_PAULO_NOV_2026 as SP } from '../../poker/festivals-nov-2026';
import { EMPTY_PLAN, togglePicked } from '../festival-plan';
import { blankTrip, changeTripCurrency, currentTrip, toTripCurrency, tripFromFestival, tripToCover, tripSessions, tripsIn, tripSummary } from '../trip-math';
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

test('tripFromFestival with no schedule yet uses the official dates', () => {
  const x = tripFromFestival('t', BAHIA_JAN_2027, EMPTY_PLAN);
  assert.equal(x.currency, 'R$');
  assert.equal(new Date(x.from).getDate(), 21);
  assert.equal(new Date(x.from).getMonth(), 0);
  assert.equal(new Date(x.to).getDate(), 31);
});

test('a festival session played after the trip\'s dates widens the trip, so it counts', () => {
  // Made from 1A only (13 Nov): 12–14 Nov.
  const made = tripFromFestival('tr', SP, togglePicked(EMPTY_PLAN, '1-1A'), undefined, 0);
  const on17 = new Date(2026, 10, 17, 14).getTime();
  const s = mk({ id: 'main', currency: 'R$', startedAt: on17, endedAt: on17 + 6 * H, buyIn: 5000 });
  assert.equal(tripSummary(made, [s]).sessions, 0);
  const wide = tripToCover([made], SP.id, on17)!;
  assert.equal(wide.from, made.from);
  assert.equal(wide.to, new Date(2026, 10, 17, 23, 59, 59, 999).getTime());
  assert.equal(tripSummary(wide, [s]).sessions, 1);
  assert.equal(tripSummary(wide, [s]).poker, -5000);
  // Already inside, another festival, or no trip: nothing to change.
  assert.equal(tripToCover([wide], SP.id, on17 + H), null);
  assert.equal(tripToCover([wide], 'other', on17 + 3 * DAY), null);
  assert.equal(tripToCover([], SP.id, on17), null);
  // Before the start too.
  assert.equal(tripToCover([made], SP.id, new Date(2026, 10, 10, 20).getTime())!.from, new Date(2026, 10, 10).getTime());
});

test('changing the trip currency flips the rate to the other currency, or drops it', () => {
  const trip = { currency: '$', fx: { currency: '€', rate: 0.92 } };
  const eur = changeTripCurrency(trip, '€', 0.92, '€');
  assert.deepEqual(eur, { currency: '€', fx: { currency: '$', rate: 1.087 } });
  // The 500 $ hotel is still about 460 €, not 543 €.
  assert.ok(Math.abs(toTripCurrency(500, '$', eur)! - 460) < 0.1);
  // And back: 1 $ = 0,92 € again, to 6 digits.
  assert.deepEqual(changeTripCurrency(eur, '$', 1.087, '$'), { currency: '$', fx: { currency: '€', rate: 0.919963 } });
  // Below 1 the rate keeps 6 digits: 7,4601 kr → 0,134046 → 7,4601 kr (4 digits gave 7,4627).
  const kr = changeTripCurrency({ currency: '€', fx: { currency: 'kr', rate: 7.4601 } }, 'kr', 7.4601, 'kr');
  assert.equal(kr.fx!.rate, 0.134046);
  assert.equal(changeTripCurrency(kr, '€', kr.fx!.rate, '€').fx!.rate, 7.4601);
  // Small rates keep their digits: 1 € = 160 ¥ → 1 ¥ = 0,006250 €.
  assert.equal(changeTripCurrency({ currency: '€', fx: { currency: '¥', rate: 160 } }, '¥', 160, '¥').fx!.rate, 0.00625);
  // An unrelated currency: the rate no longer means anything.
  assert.deepEqual(changeTripCurrency(trip, '€', 0.92, '£'), { currency: '£', fx: { currency: '€', rate: 0 } });
  // No rate typed: nothing to flip, nothing made up.
  assert.deepEqual(changeTripCurrency({ currency: '$' }, '€', 0, '€'), { currency: '€', fx: undefined });
  // Same currency: unchanged.
  assert.equal(changeTripCurrency(trip, '€', 0.92, '$'), trip);
});

// Meaningful in any time zone; checked by hand with TZ=Europe/Lisbon and TZ=America/Los_Angeles.
test('a new trip lasts five calendar days across a DST change', () => {
  const x = blankTrip('t', '€', new Date(2026, 9, 22, 0, 30).getTime());
  assert.equal(x.to, new Date(2026, 9, 26, 23, 59, 59, 999).getTime());
  const y = blankTrip('t', '€', new Date(2026, 2, 26, 23, 30).getTime());
  assert.equal(y.to, new Date(2026, 2, 30, 23, 59, 59, 999).getTime());
});
