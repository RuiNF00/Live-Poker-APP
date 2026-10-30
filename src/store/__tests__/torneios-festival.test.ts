/// <reference types="node" />
// A festival tournament recorded as it is played: flights, bullets, bounties won on the way out,
// a bagged Day 1, Day 2 and the prize, plus a satellite seat. One tournament stays one session,
// and the money and the stats come out as the cashier and the results page say.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BAHAMAS_DEC_2026 as F } from '../../poker/festival-data';
import { venueTime } from '../../poker/festivals';
import { templateStructure } from '../../poker/tourney';
import { EMPTY_PLAN, eventAction } from '../festival-plan';
import { bagDay, reenterFlight, resumeDay } from '../multi-day';
import { cost, profit, totals } from '../session-math';
import { summarize } from '../tourney-stats';
import type { Session } from '../types';

const H = 3_600_000;
// Any time after the event's day: the planner offers its rows.
const LATE = Date.UTC(2028, 0, 1);
const ev = (id: string) => F.events.find((e) => e.id === id)!;

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 'x', kind: 'mtt', name: '#12 Super Main Event · Flight A', venue: 'Baha Mar', currency: '$', startedAt: 0, breaks: [],
    buyIn: 26000, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', level: 1, tableSize: 8, stack: 60000,
    stackLog: [{ t: 0, stack: 60000, level: 1 }], roster: [], notes: '',
    ...over,
  };
}

test('a PKO flight busted with bounties: the next flight is a re-entry, and the bounties stay won', () => {
  const plan = { ...EMPTY_PLAN, sessions: { '12-A': 'x' } };
  // Out in Flight A at level 14 with two bounties collected ($8 000 in cash, the session's prize).
  const busted = mk({ endedAt: 9 * H, stack: 0, level: 14, sb: 2500, bb: 5000, ante: 5000, cashOut: 8000, bounties: 8000, tourney: { startStack: 60000, left: 212, entries: 431, bounties: 8000 } });
  // It offered a second session for the same tournament (a fresh buy-in, counted as two tournaments).
  assert.equal(eventAction(F, plan, [busted], ev('12-B'), LATE)!.kind, 'reenter');
  // A prize beyond the bounties is a cash: nothing to re-enter.
  assert.equal(eventAction(F, plan, [{ ...busted, cashOut: 50000 }], ev('12-B'), LATE)?.kind, 'start');

  const published = venueTime(F, ev('12-B').start);
  const b = reenterFlight(busted, '#12 Super Main Event · Flight B', 30 * H, { levelStartedAt: published, stack: 60000, levelMinutes: 40 });
  // The $8 000 was paid out in Flight A: it stays in the prize, so the session reads $8 000 − 2 × $26 000.
  assert.equal(b.cashOut, 8000);
  assert.equal(b.bounties, 8000);
  assert.equal(cost(b), 52000);
  assert.equal(profit(b), -44000);
  // Flight B starts at level 1 with a full stack, its clock on the published start (it kept Flight A's level 14 blinds).
  assert.deepEqual([b.level, b.sb, b.bb, b.ante, b.stage], [1, 100, 200, 200, 'early']);
  assert.equal(b.levelMinutes, 40);
  assert.equal(b.levelStartedAt, published);
  assert.equal(b.stack, 60000);
  assert.equal(b.stackLog.at(-1)!.level, 1);
  // Bounties written above the prize (an edit of the prize after them) or unreadable: only what the prize holds stays.
  assert.equal(reenterFlight({ ...busted, cashOut: 5000 }, 'B', 30 * H).cashOut, 5000);
  assert.equal(reenterFlight({ ...busted, bounties: NaN, tourney: { ...busted.tourney!, bounties: undefined } }, 'B', 30 * H).cashOut, 0);
  // Players left was Flight A's count.
  assert.equal(b.tourney!.left, undefined);
  assert.equal(b.tourney!.entries, 431);
});

test('a re-entry on a session with a blind structure starts on its level 1', () => {
  const structure = templateStructure(30).map((l) => ({ ...l, sb: l.sb / 4, bb: l.bb / 4, ante: l.ante / 4 }));
  const busted = mk({ endedAt: 6 * H, level: 12, sb: structure[11].sb, bb: structure[11].bb, ante: structure[11].ante, levelMinutes: 30, tourney: { structure, startStack: 30000 } });
  const b = reenterFlight(busted, '#12 · Flight C', 20 * H);
  assert.deepEqual([b.level, b.sb, b.bb, b.ante, b.levelMinutes], [1, structure[0].sb, structure[0].bb, structure[0].ante, 30]);
  assert.equal(b.levelStartedAt, 20 * H);
  assert.equal(b.stack, 30000);
});

test('two bullets, a bagged Day 1 and a cash on Day 2: one tournament, two entries, the prize with its bounties', () => {
  const a = mk({ endedAt: 5 * H, cashOut: 2500, bounties: 2500 });
  const b = reenterFlight(a, '#12 · Flight B', 26 * H, { stack: 60000, levelMinutes: 40 });
  const bagged = bagDay(b, 241000, 36 * H);
  // While the chips are in the bag, it is not a tournament over: ITM doesn't count it yet.
  assert.equal(totals([bagged]).itm, null);
  const d2 = resumeDay(bagged, 50 * H);
  // Busts 38th of 431 on Day 2: $61 500 for the place plus $11 000 in bounties over both flights.
  const done = { ...d2, endedAt: 58 * H, cashOut: 61500 + 11000, bounties: 11000, finish: 38, field: 431 };
  assert.equal(profit(done), 72500 - 52000);
  const tt = totals([done]);
  assert.equal(tt.sessions, 1);
  assert.equal(tt.itm, 100);
  const s = summarize([done], 'action');
  assert.deepEqual([s.count, s.entries, s.reentriesPer, s.itm, s.bounties, s.net], [1, 2, 1, 100, 11000, 20500]);
});

test('a satellite seat: the seat is the satellite prize and the main event buy-in, so the money nets out', () => {
  const sat = mk({ id: 'sat', name: 'Satellite to #12', buyIn: 2200, cashOut: 26000, finish: 3, field: 40, endedAt: 4 * H });
  const main = mk({ id: 'main', startedAt: 24 * H, endedAt: 30 * H });
  const tt = totals([sat, main]);
  assert.equal(tt.profit, -2200);
  assert.equal(tt.sessions, 2);
  assert.equal(tt.itm, 50);
});
