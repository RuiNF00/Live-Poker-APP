/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { festivalOn } from '../../lib/attribution';
import { BAHAMAS_DEC_2026, BARCELONA_MAR_2027, FESTIVALS, LOS_ANGELES_JAN_2027 } from '../../poker/festival-data';
import { festivalSortKey, festivalSpan } from '../../poker/festivals';
import { EMPTY_PLAN } from '../festival-plan';
import { allFestivals, dayKey, loadOwnFestivals, shippedFestivals, deleteOwnFestival, festivalById, notOver, ownFestival, ownFestivalOk, saveOwnFestival, soon } from '../my-festivals';
import { tripFollowingFestival, tripFromFestival } from '../trip-math';
import type { Session } from '../types';

const DAY = 86_400_000;
const input = { name: '  Malta, novembro 2026 ', city: 'St. Julian’s', currency: '€', from: '2026-11-05', to: '2026-11-12' };

test('own festival: trimmed name, the city as venue, dates, no schedule or source', () => {
  const f = ownFestival('fx_1', input, new Date(2026, 9, 17).getTime());
  assert.equal(f.name, 'Malta, novembro 2026');
  assert.equal(f.venue, 'St. Julian’s');
  assert.deepEqual(f.dates, { from: '2026-11-05', to: '2026-11-12' });
  assert.deepEqual(f.events, []);
  assert.equal(f.own, true);
  assert.deepEqual(festivalSpan(f), f.dates);
});

test("own festival: the offset is the phone's on its first day, not on the day it was added", () => {
  const f = ownFestival('fx_1', input, new Date(2026, 6, 1).getTime());
  assert.equal(f.utcOffset, -new Date(2026, 10, 5, 12).getTimezoneOffset());
});

test('the form needs a name and an end on or after the start', () => {
  assert.equal(ownFestivalOk(input), true);
  assert.equal(ownFestivalOk({ ...input, name: ' ' }), false);
  assert.equal(ownFestivalOk({ ...input, to: '2026-11-04' }), false);
  assert.equal(ownFestivalOk({ ...input, from: '' }), false);
  assert.equal(ownFestivalOk({ ...input, to: input.from }), true, 'one-day festival');
});

test('own festivals sit in the list by start date, are found by id, and go when deleted', async () => {
  await loadOwnFestivals();
  assert.equal(shippedFestivals(), FESTIVALS, 'the schedules come in with the launch load');
  const f = ownFestival('fx_2', input);
  saveOwnFestival(f);
  const ids = allFestivals().map((x) => x.id);
  assert.deepEqual(festivalById('fx_2'), { ...f, updatedAt: festivalById('fx_2')?.updatedAt });
  assert.ok(festivalById('fx_2')?.updatedAt, 'saved with its time, so an edit after a delete elsewhere wins');
  // 5 Nov comes before the 2 Dec festival.
  assert.ok(ids.indexOf('fx_2') < ids.indexOf(BAHAMAS_DEC_2026.id));
  deleteOwnFestival('fx_2');
  assert.equal(festivalById('fx_2'), undefined);
  assert.equal(allFestivals().length, FESTIVALS.length);
});

test('the list is by start; a month-only festival sits mid-month', () => {
  assert.equal(festivalSortKey(BARCELONA_MAR_2027), '2027-03-15');
  assert.equal(festivalSortKey(LOS_ANGELES_JAN_2027), '2027-01-15');
  const keys = allFestivals().map(festivalSortKey);
  assert.deepEqual([...keys].sort(), keys);
});

test('over: after the last day, or after the month for a month-only one', () => {
  const f = ownFestival('fx_3', input);
  assert.equal(notOver(f, '2026-11-12'), true);
  assert.equal(notOver(f, '2026-11-13'), false);
  assert.equal(notOver(BARCELONA_MAR_2027, '2027-03-31'), true);
  assert.equal(notOver(BARCELONA_MAR_2027, '2027-04-01'), false);
});

test('a festival is on for own festivals and dates-only ones too', () => {
  const f = ownFestival('fx_4', input);
  const at = (d: string) => new Date(d + 'T12:00:00').getTime();
  assert.equal(festivalOn(at('2026-11-08'), [f]), true);
  assert.equal(festivalOn(at('2026-11-04'), [f]), true, 'the day before');
  assert.equal(festivalOn(at('2026-11-20'), [f]), false);
  assert.equal(festivalOn(at('2027-02-01'), [LOS_ANGELES_JAN_2027]), true);
  // No dates out yet: never on.
  assert.equal(festivalOn(at('2027-03-15'), [BARCELONA_MAR_2027]), false);
});

test('a trip from an own festival takes its dates and name', () => {
  const f = ownFestival('fx_5', input);
  const trip = tripFromFestival('tr_1', f, EMPTY_PLAN);
  assert.equal(trip.festivalId, 'fx_5');
  assert.equal(trip.name, 'Malta, novembro 2026');
  assert.equal(trip.venue, 'St. Julian’s');
  assert.equal(dayKey(trip.from + DAY), '2026-11-05');
  assert.equal(dayKey(trip.to - DAY), '2026-11-12');
});

test('soon: on now or within a week; never for a month-only festival', () => {
  const f = ownFestival('fx_6', input);
  assert.equal(soon(f, '2026-10-29'), true, '7 days before');
  assert.equal(soon(f, '2026-10-28'), false, '8 days before');
  assert.equal(soon(f, '2026-11-10'), true, 'on now');
  assert.equal(soon(f, '2026-11-13'), false, 'over');
  assert.equal(soon(BARCELONA_MAR_2027, '2027-03-10'), false);
});

test('editing an own festival moves its trip, unless the player changed that part of the trip', () => {
  const malta = { ...input, name: 'Malta', from: '2026-11-20', to: '2026-11-27' };
  const old = ownFestival('fx_7', malta);
  const trip = tripFromFestival('tr_7', old, EMPTY_PLAN);
  assert.deepEqual([dayKey(trip.from), dayKey(trip.to)], ['2026-11-19', '2026-11-28']);
  const later = ownFestival('fx_7', { ...malta, name: 'Malta Poker Festival', to: '2026-12-05' });
  const moved = tripFollowingFestival(trip, old, later, EMPTY_PLAN, [])!;
  assert.deepEqual([dayKey(moved.from), dayKey(moved.to), moved.name], ['2026-11-19', '2026-12-06', 'Malta Poker Festival']);
  assert.equal(moved.id, 'tr_7');
  // Renamed and its end moved by hand: those stay; the start still follows.
  const own = { ...trip, name: 'Malta com a Ana', to: trip.to + 2 * DAY };
  const earlier = ownFestival('fx_7', { ...malta, from: '2026-11-18', to: '2026-12-05' });
  const kept = tripFollowingFestival(own, old, earlier, EMPTY_PLAN, [])!;
  assert.deepEqual([dayKey(kept.from), kept.to, kept.name], ['2026-11-17', own.to, 'Malta com a Ana']);
  // Nothing the trip follows changed: nothing to save.
  assert.equal(tripFollowingFestival(trip, old, ownFestival('fx_7', { ...malta, currency: '$' }), EMPTY_PLAN, []), null);
});

test('a shorter festival never drops sessions its trip already counts', () => {
  const malta = { ...input, name: 'Malta', from: '2026-11-20', to: '2026-11-27' };
  const old = ownFestival('fx_8', malta);
  const trip = tripFromFestival('tr_8', old, EMPTY_PLAN);
  const at = (d: string) => new Date(d + 'T20:00:00').getTime();
  const played = [{ id: 's1', startedAt: at('2026-11-26'), endedAt: at('2026-11-26') + 3_600_000 }] as Session[];
  const shorter = ownFestival('fx_8', { ...malta, from: '2026-11-22', to: '2026-11-24' });
  const x = tripFollowingFestival(trip, old, shorter, EMPTY_PLAN, played)!;
  // The start moves (nothing was played before it), the end keeps 28 Nov for the session on the 26th.
  assert.deepEqual([dayKey(x.from), x.to], ['2026-11-21', trip.to]);
  assert.deepEqual([dayKey(tripFollowingFestival(trip, old, shorter, EMPTY_PLAN, [])!.to)], ['2026-11-25']);
});
