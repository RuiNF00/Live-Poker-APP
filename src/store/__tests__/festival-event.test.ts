/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LISBOA_NOV_2026, SAO_PAULO_NOV_2026 as SP } from '../../poker/festivals-nov-2026';
import { BAHAMAS_DEC_2026 as F } from '../../poker/festival-data';
import { venueTime } from '../../poker/festivals';
import { entryFlights, flightLabel, hoursLabel, lateRegClose, phoneStart, tournamentRows } from '../festival-event';
import { ownEvent } from '../festival-plan';

const byId = (f: typeof SP, id: string) => f.events.find((e) => e.id === id)!;

test('a tournament lists every flight and its Day 2, in start order', () => {
  const rows = tournamentRows(SP, byId(SP, '26-1C'));
  assert.deepEqual(rows.map((e) => e.id), ['26-1A', '26-1B', '26-1C', '26-1D', '26-1E', '26-1F', '26-1G', '26-1H', '26-1I', '26-1J', '26-2']);
  assert.equal(entryFlights(rows).length, 10);
  // Bahamas Main Event: three flights and two Day 2s.
  assert.deepEqual(tournamentRows(F, byId(F, '12-A')).map((e) => e.flight), ['A', '2A', 'B', 'C', '2BC']);
});

test('a single event is its own only row; an added tournament never joins a published one', () => {
  assert.deepEqual(tournamentRows(SP, byId(SP, '2')).map((e) => e.id), ['2']);
  const own = ownEvent('own-1', { name: 'Main Event', start: '2026-11-16T12:00', game: 'NLH', buyIn: 5000 }, 1);
  const f = { ...SP, events: [...SP.events, own] };
  assert.deepEqual(tournamentRows(f, own).map((e) => e.id), ['own-1']);
});

test('late reg closes at the official time, or the one the player set', () => {
  const e = byId(SP, '26-1A');
  assert.equal(lateRegClose(SP, e, e.lateRegMin), venueTime(SP, '2026-11-16T12:00') + 465 * 60_000);
  assert.equal(lateRegClose(SP, e, 120), venueTime(SP, '2026-11-16T12:00') + 120 * 60_000);
  assert.equal(lateRegClose(SP, e, undefined), undefined);
});

test('labels: flights, Day 2s and hours', () => {
  assert.equal(flightLabel(byId(SP, '26-1B')), 'Flight 1B');
  assert.equal(flightLabel(byId(SP, '26-2')), 'Dia 2');
  assert.equal(flightLabel(byId(F, '12-2BC')), 'Dia 2 · Flight 2BC');
  assert.equal(flightLabel(byId(SP, '2')), null);
  assert.equal(hoursLabel(465), '7 h 45');
  assert.equal(hoursLabel(300), '5 h');
  assert.equal(hoursLabel(45), '45 min');
});

test('the start on the phone: only when its zone differs, with the day when it changes', () => {
  const e = byId(SP, '26-1B'); // 20:00 in São Paulo (UTC−3)
  assert.equal(phoneStart(SP, e, () => -180), null);
  const lisbon = phoneStart(SP, e, () => 0); // 23:00 in Lisbon, same day
  assert.equal(lisbon?.otherDay, false);
  assert.equal(lisbon?.ms, venueTime(SP, e.start));
  assert.equal(phoneStart(SP, e, () => 60)?.otherDay, true); // 00:00 next day in Madrid
  assert.equal(phoneStart(LISBOA_NOV_2026, LISBOA_NOV_2026.events[0], () => 0), null);
});
