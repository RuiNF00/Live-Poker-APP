/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import type { Session, Trip } from '../../store/types';
import { bestHandOf, biLabel, carouselCaption, carouselSlides, dayKey, eventRows, festivalRecap, moneyLabel, recapStats, resultLabel, tripWeeks } from '../festival-card';

const H = 3_600_000;
const D = 24 * H;
const T0 = new Date(2026, 11, 2, 0, 0).getTime();

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: 'Casino', currency: '$', startedAt: T0 + 12 * H, endedAt: T0 + 20 * H, breaks: [],
    buyIn: 1000, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

const trip: Trip = { id: 't', name: 'Bahamas, dezembro 2026', venue: 'Baha Mar, Nassau', currency: '$', from: T0, to: T0 + 16 * D - 1, expenses: [], createdAt: 0 };

test('days, events, cashes, best finish and the result in buy-ins', () => {
  const sessions = [
    mk({ id: 'a', cashOut: 0 }),
    // A two-day tournament: the overnight bag counts its second day.
    mk({ id: 'b', startedAt: T0 + D + 12 * H, endedAt: T0 + 2 * D + 20 * H, breaks: [{ start: T0 + D + 23 * H, end: T0 + 2 * D + 12 * H }], cashOut: 5200, finish: 9, field: 412 }),
    mk({ id: 'c', startedAt: T0 + 4 * D + 12 * H, endedAt: T0 + 4 * D + 18 * H, buyIn: 2000, cashOut: 0 }),
    // Outside the trip: not counted.
    mk({ id: 'z', startedAt: T0 + 30 * D, endedAt: T0 + 30 * D + H, cashOut: 9000 }),
  ];
  const r = festivalRecap(trip, sessions, []);
  assert.equal(r.days, 4);
  assert.equal(r.events, 3);
  assert.equal(r.cashes, 1);
  assert.deepEqual(r.best, { finish: 9, field: 412 });
  // Net 5200 − 4000 = +1200 over an average buy-in of 1333: +0.9.
  assert.equal(r.money, 1200);
  assert.equal(r.result?.unit, 'bi');
  assert.equal(resultLabel(r.result!), '+0,9 buy-ins');
  assert.equal(moneyLabel(r), '+1200$');
  assert.deepEqual(
    recapStats(r).map((x) => [x.key, x.value]),
    [['days', '4'], ['events', '3'], ['cashes', '1/3'], ['place', '9.º/412']],
  );
});

test('buy-ins count only the part of the action the player kept', () => {
  const s = mk({ buyIn: 1000, cashOut: 0, stakes: [{ share: 50, markup: 1 }] });
  const r = festivalRecap(trip, [s], []);
  // Lost their own 500: one of their (500) buy-ins.
  assert.equal(resultLabel(r.result!), '−1 buy-in');
});

test('a cash-only trip reads in big blinds', () => {
  const s = mk({ kind: 'cash', buyIn: 1000, cashOut: 1800, bb: 5 });
  const r = festivalRecap(trip, [s], []);
  assert.deepEqual(r.result, { value: 160, unit: 'bb' });
  assert.equal(resultLabel(r.result!), '+160 bb');
  assert.deepEqual(recapStats(r).map((x) => x.key), ['days', 'cash']);
});

test('no amount and no venue on the card data unless asked for', () => {
  const r = festivalRecap(trip, [mk({ cashOut: 3000 })], []);
  assert.equal(r.title, 'Bahamas, dezembro 2026');
  assert.ok(!JSON.stringify(recapStats(r)).includes('$'));
  assert.ok(!resultLabel(r.result!).includes('$'));
  assert.ok(!JSON.stringify({ ...r, played: [...r.played] }).includes('Baha Mar'));
});

test('best hand: the trip hand where hero won the most big blinds', () => {
  const h = { ...sampleHand('a'), sessionId: 's' };
  const best = bestHandOf([h]);
  assert.ok(best && best.bb > 0);
  const r = festivalRecap(trip, [mk()], [h, { ...sampleHand('other'), sessionId: 'elsewhere' }]);
  assert.equal(r.bestHand?.hand.id, 'a');
  // A hand that doesn't replay is skipped, not a crash.
  assert.equal(bestHandOf([{ ...h, actions: [{ p: 99, kind: 'call' }] } as never]), null);
});

test('carousel: events, days cashed, slides and the caption without amounts', () => {
  const sessions = [
    mk({ id: 'a', name: 'Opener', cashOut: 0 }),
    mk({ id: 'b', name: 'Main', startedAt: T0 + D + 12 * H, endedAt: T0 + 2 * D + 20 * H, cashOut: 5200, finish: 9, field: 412 }),
    mk({ id: 'k', kind: 'cash', startedAt: T0 + 3 * D, endedAt: T0 + 3 * D + 4 * H, bb: 5 }),
  ];
  const r = festivalRecap(trip, sessions, []);
  assert.deepEqual([...r.cashedOn], [dayKey(T0 + 2 * D + 20 * H)]);

  const ev = eventRows(trip, sessions);
  assert.deepEqual(ev.map((e) => [e.name, e.cashed, e.bi]), [['Opener', false, -1], ['Main', true, 4.2]]);
  assert.equal(biLabel(4.2), '+4,2 bi');
  // Only the best `max`, still in the order played.
  assert.deepEqual(eventRows(trip, sessions, 1).map((e) => e.id), ['b']);

  assert.deepEqual(carouselSlides(r, ev, { showHand: true, brand: true }), ['summary', 'events', 'days', 'close']);
  assert.deepEqual(carouselSlides(r, [], { showHand: true, brand: false }), ['summary', 'days']);

  const link = 'https://sweatbook.poker/r/abc?utm_medium=carousel';
  const cap = carouselCaption(r, link, { showResult: true, showMoney: false });
  assert.ok(cap.startsWith('Bahamas, dezembro 2026: 2 eventos, 1/2 nos prémios, melhor lugar 9.º/412'));
  assert.ok(cap.includes(link));
  assert.ok(!cap.includes('$'));
  assert.ok(!cap.includes('Casino'));
  assert.ok(carouselCaption(r, link, { showResult: true, showMoney: true }).includes('$'));
  assert.ok(!carouselCaption(r, link, { showResult: false, showMoney: false }).includes('buy-in'));
});

test('trip weeks start on Monday and pad the days outside the trip', () => {
  // 2 Dec 2026 is a Wednesday; 17 Dec a Thursday.
  const w = tripWeeks(T0, T0 + 16 * D - 1);
  assert.equal(w.length, 3);
  assert.deepEqual(w[0].slice(0, 3).map((x) => x === null), [true, true, false]);
  assert.equal(new Date(w[0][2]!).getDate(), 2);
  assert.equal(w.flat().filter((x) => x !== null).length, 16);
});
