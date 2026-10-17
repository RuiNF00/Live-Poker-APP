/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FESTIVALS, LAS_VEGAS_DEC_2026 as LV, venueTime, BAHAMAS_DEC_2026 as F } from '../../poker/festivals';
import { bankrollShare, EMPTY_PLAN, eventAction, festivalName, plannedNow, planReminders, planTotals, togglePicked } from '../festival-plan';

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
      ['bahamas-dez-2026:1-A:start', venueTime(F, '2026-12-02T10:30')],
      ['bahamas-dez-2026:12-A:start', start12 - 30 * 60_000],
      ['bahamas-dez-2026:12-A:late', start12 + (6 * 60 - 30) * 60_000],
    ],
  );
  // Past ones are dropped.
  assert.deepEqual(planReminders(F, p, start12).map((x) => x.id), ['bahamas-dez-2026:12-A:late']);
});

test('ships without an event brand; the player can name the festival', () => {
  for (const f of FESTIVALS) assert.doesNotMatch(JSON.stringify(f), /wsop|ggmillion|ggpoker|wpt|world poker tour|wynn|baha mar|baha-|paradise|colossus|plossus|circuit|prime|world championship|super main|bsop|\bcep\b|sau[ií]pe/i, f.id);
  // No outbound links: organisers also run real-money gaming sites (store review).
  for (const f of FESTIVALS) assert.doesNotMatch(JSON.stringify(f), /https?:|www\./i, f.id);
  assert.equal(festivalName(F, EMPTY_PLAN), 'Bahamas, dezembro 2026');
  assert.equal(festivalName(F, { ...EMPTY_PLAN, name: '  Bahamas com a malta ' }), 'Bahamas com a malta');
  assert.equal(festivalName(F, { ...EMPTY_PLAN, name: '   ' }), 'Bahamas, dezembro 2026');
});

test('one tournament across flights and days: start, re-enter a later flight, resume Day 2', () => {
  const base = { id: 'x', kind: 'mtt' as const, name: '', venue: '', currency: '$', startedAt: 1, breaks: [], buyIn: 26000, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb' as const, tableSize: 8, stack: 60000, stackLog: [], roster: [], notes: '' };
  const ev = (id: string) => F.events.find((e) => e.id === id)!;
  assert.deepEqual(eventAction(F, EMPTY_PLAN, [], ev('12-A')), { kind: 'start' });
  assert.equal(eventAction(F, EMPTY_PLAN, [], ev('12-2A')), null);

  const plan = { ...EMPTY_PLAN, sessions: { '12-A': 'x' } };
  // Playing Flight A: every row of #12 points at that session.
  assert.equal(eventAction(F, plan, [base], ev('12-B'))!.kind, 'view');
  // Busted in A: Flight B is a re-entry, A itself has nothing left to do.
  const busted = { ...base, endedAt: 2 };
  assert.equal(eventAction(F, plan, [busted], ev('12-B'))!.kind, 'reenter');
  assert.equal(eventAction(F, plan, [busted], ev('12-A')), null);
  assert.equal(eventAction(F, plan, [busted], ev('12-2A')), null);
  // Bagged in A: Day 2 picks it up; no new flight while chips are in the bag.
  const bagged = { ...base, endedAt: 2, bag: { stack: 185000, at: 2 } };
  assert.equal(eventAction(F, plan, [bagged], ev('12-2A'))!.kind, 'resume');
  // Bagged in Flight A: the 2BC restart isn't yours.
  assert.equal(eventAction(F, plan, [bagged], ev('12-2BC')), null);
  assert.equal(eventAction(F, { ...EMPTY_PLAN, sessions: { '12-C': 'x' } }, [bagged], ev('12-2BC'))!.kind, 'resume');
  assert.equal(eventAction(F, plan, [bagged], ev('12-B')), null);
  // Busted in A, re-entered in B and bagged there: only the Day 2 that takes B.
  const both = { ...EMPTY_PLAN, sessions: { '12-A': 'x', '12-B': 'x' } };
  assert.equal(eventAction(F, both, [bagged], ev('12-2A')), null);
  assert.equal(eventAction(F, both, [bagged], ev('12-2BC'))!.kind, 'resume');
  // Other events are untouched.
  assert.deepEqual(eventAction(F, plan, [bagged], ev('13')), { kind: 'start' });
});

test('Las Vegas schedule: matches the organiser page, no event numbers shown, Day 2 resumes a bagged flight', () => {
  assert.equal(new Set(LV.events.map((e) => e.id)).size, LV.events.length);
  const starts = LV.events.map((e) => e.start);
  assert.deepEqual([...starts].sort(), starts);
  assert.equal(LV.events[0].start, '2026-11-27T12:00');
  assert.equal(LV.events.at(-1)!.start, '2026-12-21T18:00');
  assert.equal(LV.events.filter((e) => e.name.startsWith('Satellite')).length, 25);
  const wc = LV.events.filter((e) => e.name === 'Main Event');
  assert.deepEqual(wc.map((e) => [e.flight, e.buyIn, e.start]), [
    ['1A', 10400, '2026-12-13T11:00'],
    ['1B', 10400, '2026-12-14T11:00'],
    ['1C', 10400, '2026-12-15T11:00'],
    ['2', 0, '2026-12-16T12:00'],
  ]);
  assert.equal(LV.events.find((e) => e.name === 'NLH High Roller (2 Day)')!.buyIn, 25800);
  assert.ok(LV.events.every((e) => e.unnumbered));
  // Las Vegas is UTC-8 in December.
  assert.equal(new Date(venueTime(LV, '2026-12-13T11:00')).toISOString(), '2026-12-13T19:00:00.000Z');
  const bagged = { id: 'w', kind: 'mtt' as const, name: '', venue: '', currency: '$', startedAt: 1, endedAt: 2, bag: { stack: 120000, at: 2 }, breaks: [], buyIn: 10400, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb' as const, tableSize: 8, stack: 120000, stackLog: [], roster: [], notes: '' };
  const day2 = LV.events.find((e) => e.name === 'Main Event' && e.day2)!;
  assert.equal(eventAction(LV, { ...EMPTY_PLAN, sessions: { [wc[1].id]: 'w' } }, [bagged], day2)!.kind, 'resume');
});

test('plannedNow: the planned event from 2 h before its start until late reg closes', () => {
  const a = venueTime(F, '2026-12-02T11:00');
  const plan = { ...EMPTY_PLAN, picked: ['1-A', '1-B'] };
  assert.equal(plannedNow(F, EMPTY_PLAN, [], a), null);
  assert.equal(plannedNow(F, plan, [], a - 3 * 3_600_000), null);
  assert.equal(plannedNow(F, plan, [], a - 3_600_000)!.e.id, '1-A');
  // Default window 4 h after the start, or the late reg the player typed.
  assert.equal(plannedNow(F, plan, [], a + 5 * 3_600_000)!.e.id, '1-B');
  assert.equal(plannedNow(F, { ...plan, lateReg: { '1-A': 360 } }, [], a + 5 * 3_600_000)!.e.id, '1-A');
  // Already running: nothing to start (the live session is on screen instead).
  const running = { id: 'x', kind: 'mtt' as const, name: '', venue: '', currency: '$', startedAt: a, breaks: [], buyIn: 2750, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb' as const, tableSize: 8, stack: 60000, stackLog: [], roster: [], notes: '' };
  assert.equal(plannedNow(F, { ...plan, sessions: { '1-A': 'x' } }, [running], a + 3_600_000), null);
  // Busted in A: B is a re-entry.
  const late = plannedNow(F, { ...plan, sessions: { '1-A': 'x' } }, [{ ...running, endedAt: a + 3_600_000 }], venueTime(F, '2026-12-02T16:00'));
  assert.equal(late!.e.id, '1-B');
  assert.equal(late!.action.kind, 'reenter');
});

test('Las Vegas: published starting stack and level length, none for Turbo flights or Day 2s', () => {
  const ev = (id: string) => LV.events.find((e) => e.id === id)!;
  assert.deepEqual([ev('10-1A').stack, ev('10-1A').levelMinutes], [100000, 60]);
  assert.deepEqual([ev('24').stack, ev('24').levelMinutes], [200000, 40]);
  assert.equal(ev('10-2').stack, undefined);
  assert.equal(ev('29-1B Turbo').stack, undefined);
  assert.equal(ev('29-1A').stack, 40000);
});
