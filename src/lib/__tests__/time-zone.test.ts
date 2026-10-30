/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { playedClock, zoneOffset } from '../time-zone';

test('zone offsets follow the zone’s own summer time', () => {
  assert.equal(zoneOffset('America/Los_Angeles', Date.UTC(2026, 11, 31, 12)), -480);
  assert.equal(zoneOffset('America/Los_Angeles', Date.UTC(2026, 6, 1, 12)), -420);
  assert.equal(zoneOffset('Europe/Lisbon', Date.UTC(2026, 6, 1, 12)), 60);
  assert.equal(zoneOffset('Not/AZone', 0), null);
});

test('a night in Las Vegas on 31 December stays in that year on any phone', () => {
  const ms = Date.UTC(2027, 0, 1, 7); // 23:00 on 31 Dec in Las Vegas
  const d = new Date(playedClock(ms, 'America/Los_Angeles'));
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 11, 31, 23]);
  assert.equal(playedClock(ms, undefined), ms, 'no zone: as before');
  assert.equal(playedClock(ms, 'Not/AZone'), ms);
});

test('the app’s period filter and year recap put it in the same year as the PDF', async () => {
  const { applyFilter, NO_FILTER } = await import('../../store/bankroll-math');
  const { yearSessions } = await import('../../store/year-recap');
  const ms = Date.UTC(2027, 0, 1, 7);
  const s = { id: 'v', kind: 'cash', name: '', venue: '', currency: '$', startedAt: ms, endedAt: ms + 3600_000, breaks: [], buyIn: 100, entries: 1, addOn: 0, cashOut: 200, tz: 'America/Los_Angeles' } as never;
  const y2026 = { from: new Date(2026, 0, 1).getTime(), to: new Date(2027, 0, 1).getTime() - 1 };
  assert.equal(applyFilter([s], { ...NO_FILTER, range: y2026 }).length, 1);
  assert.equal(yearSessions(Array(30).fill(s), 2026)?.length, 30);
});
