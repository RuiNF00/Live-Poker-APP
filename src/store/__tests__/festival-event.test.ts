/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LISBOA_NOV_2026, SAO_PAULO_NOV_2026 as SP } from '../../poker/festivals-nov-2026';
import { BAHAMAS_DEC_2026 as F } from '../../poker/festival-data';
import { venueTime } from '../../poker/festivals';
import { STRUCTURES } from '../../poker/festival-structures';
import { bigBlinds, closeLevel, entryFlights, flightLabel, hoursLabel, lateRegClose, levelStarts, phoneStart, tournamentRows } from '../festival-event';
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

test('structure: level starts count the breaks; late reg closes where the schedule says', () => {
  const s = STRUCTURES['sao-paulo-nov-2026'][3];
  const e = byId(SP, '3'); // 25-min levels, late reg 280 min: ten levels and two 15-min breaks
  const at = levelStarts(s, 25);
  assert.equal(at[0], 0);
  assert.equal(at[5], 5 * 25 + 15);
  assert.equal(closeLevel(s, e), 11); // the sheet: "re-entry until the start of level 11"
  assert.equal(bigBlinds(s, 30000, 1), 150);
  assert.equal(bigBlinds(s, 30000, 11), 12);
  // A late reg that falls mid-level is no match: nothing is shown rather than a guess.
  assert.equal(closeLevel(s, { levelMinutes: 25, lateRegMin: 290 }), undefined);
  assert.equal(closeLevel(s, { levelMinutes: undefined, lateRegMin: 280 }), undefined);
});

test('every published structure belongs to a hold’em or Omaha tournament and reads as a blind table', () => {
  for (const [fid, byNumber] of Object.entries(STRUCTURES)) {
    const f = [SP, LISBOA_NOV_2026].find((x) => x.id === fid);
    assert.ok(f, fid);
    for (const [num, s] of Object.entries(byNumber)) {
      const rows = f.events.filter((e) => e.number === Number(num));
      assert.ok(rows.length, `${fid} #${num} has rows`);
      assert.ok(rows.every((e) => e.game !== 'Mix'), `${fid} #${num} is not a mixed game`);
      assert.ok(s.levels.length >= 10, `${fid} #${num} levels`);
      let prev = 0;
      for (const [sb, bb, ante] of s.levels) {
        assert.ok(sb > 0 && sb <= bb && bb >= prev && ante <= bb, `${fid} #${num} ${sb}/${bb}/${ante}`);
        prev = bb;
      }
      for (const [after, min] of s.breaks) assert.ok(after >= 1 && after < s.levels.length && min > 0 && min <= 90, `${fid} #${num} break after ${after}`);
    }
  }
});
