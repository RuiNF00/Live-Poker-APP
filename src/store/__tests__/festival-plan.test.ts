/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { venueTime, WSOP_PARADISE_2026 as F } from '../../poker/festivals';
import { bankrollShare, EMPTY_PLAN, planReminders, planTotals, togglePicked } from '../festival-plan';

test('schedule matches wsop.com: 20 events, 30 rows, unique ids, one buy-in per event', () => {
  assert.equal(F.events.length, 30);
  assert.equal(new Set(F.events.map((e) => e.id)).size, 30);
  assert.deepEqual([...new Set(F.events.map((e) => e.number))].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  const buy = new Map<number, number>();
  for (const e of F.events.filter((x) => !x.day2)) {
    if (buy.has(e.number)) assert.equal(e.buyIn, buy.get(e.number), `event ${e.number}`);
    buy.set(e.number, e.buyIn);
  }
  // Spot checks against the official page.
  assert.equal(buy.get(1), 2750);
  assert.equal(buy.get(12), 26000);
  assert.equal(buy.get(5), 250000);
  assert.equal(F.events.find((e) => e.id === '12-A')!.start, '2026-12-10T11:00');
  assert.equal(F.events[0].start, '2026-12-02T11:00');
  assert.equal(F.events.at(-1)!.start, '2026-12-17T12:00');
  // Day 2 restarts cost nothing.
  assert.deepEqual(F.events.filter((e) => e.day2).map((e) => [e.id, e.buyIn]), [['12-2A', 0], ['12-2BC', 0]]);
  // Rows are in start order.
  const starts = F.events.map((e) => e.start);
  assert.deepEqual([...starts].sort(), starts);
});

test('venue time is Nassau (UTC-5 in December)', () => {
  assert.equal(new Date(venueTime(F, '2026-12-10T11:00')).toISOString(), '2026-12-10T16:00:00.000Z');
});

test('totals count entries, not Day 2s, and compare with the bankroll', () => {
  let p = EMPTY_PLAN;
  for (const id of ['1-A', '12-A', '12-2A', '20']) p = togglePicked(p, id);
  assert.deepEqual(planTotals(F, p), { events: 4, entries: 3, buyIns: 2750 + 26000 + 15000 });
  p = togglePicked(p, '20');
  assert.equal(planTotals(F, p).entries, 2);
  assert.equal(bankrollShare(28750, 57500), 0.5);
  assert.equal(bankrollShare(1000, 0), null);
});

test('reminders: 30 min before start, and 30 min before late reg closes when set', () => {
  const p = { ...EMPTY_PLAN, picked: ['12-A', '1-A'], lateReg: { '12-A': 6 * 60 } };
  const start12 = venueTime(F, '2026-12-10T11:00');
  const r = planReminders(F, p, venueTime(F, '2026-12-01T00:00'));
  assert.deepEqual(
    r.map((x) => [x.id, x.at]),
    [
      ['wsop-paradise-2026:1-A:start', venueTime(F, '2026-12-02T10:30')],
      ['wsop-paradise-2026:12-A:start', start12 - 30 * 60_000],
      ['wsop-paradise-2026:12-A:late', start12 + (6 * 60 - 30) * 60_000],
    ],
  );
  // Past ones are dropped.
  assert.deepEqual(planReminders(F, p, start12).map((x) => x.id), ['wsop-paradise-2026:12-A:late']);
});
