/// <reference types="node" />
// Run in any phone zone: `npm test` here, and again with TZ=America/Los_Angeles, Europe/Lisbon, Pacific/Auckland.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReport } from '../../export/report';
import { zoneToKeep } from '../../lib/time-zone';
import { applyFilter, NO_FILTER } from '../../store/bankroll-math';
import { mergeBackups } from '../../store/backup-merge';
import { parseBackup } from '../../store/backup';
import { inMonth } from '../../store/month-recap';
import { resultDay } from '../../store/session-math';
import type { Session } from '../../store/types';
import { yearSessions } from '../../store/year-recap';
import { yearReview } from '../../share/year-review';
import { taxReport } from '../tax-math';

const H = 3_600_000;
// 31 Dec 2026, 20:00 to 23:30 in Las Vegas (PST, UTC−8): 1 Jan 04:00 UTC, already 2027 in Lisbon and Auckland.
const START = Date.UTC(2027, 0, 1, 4);
const sess = (over: Partial<Session> = {}): Session => ({
  id: 'v', kind: 'cash', name: 'NLH 2/5', venue: 'Bellagio', currency: '$', country: 'US', startedAt: START, endedAt: START + 3.5 * H, breaks: [],
  buyIn: 1000, entries: 1, addOn: 0, cashOut: 21000, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '',
  tz: 'America/Los_Angeles', withheld: { amount: 4800, form: 'W-2G', status: 'final' },
  ...over,
});
const Y = (y: number) => ({ from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime() - 1 });

test('Las Vegas, 31 Dec at 20:00: 2026 in the tax table, the PDF, the period filter and the recaps, on any phone', () => {
  const s = sess();
  const t26 = taxReport([s], Y(2026));
  assert.deepEqual([t26.rows[0]?.net, t26.rows[0]?.withheld], [20000, 4800]);
  assert.equal(taxReport([s], Y(2027)).rows.length, 0);
  assert.equal(buildReport({ sessions: [s], transfers: [], bankrolls: [], range: Y(2026) }).currencies[0]?.sessions.length, 1);
  assert.equal(buildReport({ sessions: [s], transfers: [], bankrolls: [], range: Y(2027) }).currencies.length, 0);
  assert.equal(applyFilter([s], { ...NO_FILTER, range: Y(2026) }).length, 1);
  assert.equal(inMonth([s], '2026-12').length, 1);
  assert.equal(inMonth([s], '2027-01').length, 0);
  const many = Array.from({ length: 40 }, (_, i) => sess({ id: 'v' + i }));
  assert.equal(yearSessions(many, 2026)?.length, 40);
  assert.equal(yearReview(2026, many, []).sessions, 40);
});

test('an old session with no zone counts as before: on the calendar of the phone that opens it', () => {
  const { tz: _, ...old } = sess();
  const year = new Date(START).getFullYear();
  assert.equal(resultDay(old), START);
  assert.equal(taxReport([old], Y(year)).rows.length, 1);
  // A zone the engine doesn't know (a backup from somewhere odd): as if there were none.
  assert.equal(resultDay(sess({ tz: 'Not/AZone' })), START);
});

test('both rules together: a Day 2 in Las Vegas that ended on 1 Jan local counts in 2027, one ended on 31 Dec in 2026', () => {
  // Day 1 on 29 Dec; Day 2 ends 31 Dec 23:00 Las Vegas (1 Jan 07:00 UTC).
  const d31 = sess({ kind: 'mtt', day: 2, startedAt: Date.UTC(2026, 11, 29, 20), endedAt: Date.UTC(2027, 0, 1, 7) });
  assert.equal(taxReport([d31], Y(2026)).rows.length, 1);
  // Day 2 ends 1 Jan 01:00 Las Vegas.
  const d1 = sess({ kind: 'mtt', day: 2, startedAt: Date.UTC(2026, 11, 29, 20), endedAt: Date.UTC(2027, 0, 1, 9) });
  assert.equal(taxReport([d1], Y(2027)).rows.length, 1);
});

test('a session keeps the zone it was played in; an old or imported one never takes the phone’s', () => {
  assert.equal(zoneToKeep({}, undefined, 'Europe/Lisbon'), 'Europe/Lisbon', 'new: the phone’s zone');
  assert.equal(zoneToKeep({}, { tz: 'America/Los_Angeles' }, 'Europe/Lisbon'), 'America/Los_Angeles', 'edited back home: kept');
  assert.equal(zoneToKeep({}, {}, 'Europe/Lisbon'), undefined, 'older, edited now: stays without');
  assert.equal(zoneToKeep({ tz: 'Asia/Macau' }, { tz: 'America/Los_Angeles' }, 'Europe/Lisbon'), 'Asia/Macau');
  assert.equal(zoneToKeep({}, undefined, undefined), undefined);
});

test('backups: the zone survives a restore and a merge; older copies without it, and a junk one, still open', () => {
  const backup = (sessions: unknown[]) => JSON.stringify({ app: 'sweatbook', v: 1, exportedAt: 1, hands: [], sessions, players: [] });
  const withZone = parseBackup(backup([sess()]));
  assert.equal(withZone.sessions[0].tz, 'America/Los_Angeles');
  const { tz: _, ...old } = sess({ id: 'o' });
  const older = parseBackup(backup([old]));
  assert.equal(older.sessions.length, 1);
  assert.equal(older.sessions[0].tz, undefined);
  const junk = parseBackup(backup([{ ...sess({ id: 'j' }), tz: 42 }]));
  assert.equal(junk.sessions.length, 1);
  assert.equal(junk.sessions[0].tz, undefined);
  // Another phone on an older version wrote the copy without zones: the merge keeps the newer edit and its zone.
  const merged = mergeBackups({ ...withZone, sessions: [{ ...withZone.sessions[0], updatedAt: 5 }] }, { ...older, sessions: [{ ...old, id: 'v', updatedAt: 1 }] });
  assert.equal(merged.sessions.find((s) => s.id === 'v')?.tz, 'America/Los_Angeles');
});
