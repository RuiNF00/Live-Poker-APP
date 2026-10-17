/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LISBOA_NOV_2026, PRAGUE_DEC_2026, PUNTA_CANA_JAN_2027, PUNTA_DEL_ESTE_DEC_2026, SAO_PAULO_NOV_2026, TORRELODONES_NOV_2026 } from '../../poker/festivals-nov-2026';
import { FESTIVALS, festivalSpan, LAS_VEGAS_DEC_2026 as LV, venueTime, BAHAMAS_DEC_2026 as F } from '../../poker/festivals';
import { fitPlan, planDays, planText } from '../../share/festival-plan';
import { afterSession, buyInCaps, clashes, entryBuyIn, isKind, lateRegOf, levelStart, bankrollShare, EMPTY_PLAN, eventAction, festivalName, ownEvent, plannedNow, planReminders, planTotals, removeOwnEvent, togglePicked, withPlanEvents } from '../festival-plan';

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

test('reminders: 30 min before start, and 20 min before late reg closes when set', () => {
  const p = { ...EMPTY_PLAN, picked: ['12-A', '1-A'], lateReg: { '12-A': 6 * 60 } };
  const start12 = venueTime(F, '2026-12-10T11:00');
  const r = planReminders(F, p, venueTime(F, '2026-12-01T00:00'));
  assert.deepEqual(
    r.map((x) => [x.id, x.at]),
    [
      ['bahamas-dez-2026:1-A:start', venueTime(F, '2026-12-02T10:30')],
      ['bahamas-dez-2026:12-A:start', start12 - 30 * 60_000],
      ['bahamas-dez-2026:12-A:late', start12 + (6 * 60 - 20) * 60_000],
    ],
  );
  // Names the event and the venue time it closes; no amounts.
  assert.equal(r[2].title, 'Registo do #12 Main Event · Flight A fecha às 17:00');
  assert.doesNotMatch(r[2].title + r[2].body, /\$|€|\d{3,}/);
  // A Day 2 has no registration to close.
  const d2 = F.events.find((e) => e.day2)!;
  assert.ok(!planReminders(F, { ...EMPTY_PLAN, picked: [d2.id], lateReg: { [d2.id]: 120 } }, 0).some((x) => x.id.endsWith(':late')));
  // Past ones are dropped.
  assert.deepEqual(planReminders(F, p, start12).map((x) => x.id), ['bahamas-dez-2026:12-A:late']);
  // A tap opens this festival on this event, not whichever festival comes first.
  assert.equal(r[1].url, 'sweatbook://festival?id=bahamas-dez-2026&event=12-A');
});

test('ships without an event brand; the player can name the festival', () => {
  for (const f of FESTIVALS) assert.doesNotMatch(JSON.stringify(f), /wsop|ggmillion|ggpoker|wpt|world poker tour|wynn|baha mar|baha-|paradise|colossus|plossus|circuit|prime|world championship|super main|bsop|\bcep\b|sau[ií]pe|vamos|\bvpt\b|\bcnp\b|winamax|solverde|\bept\b|pokerstars|millionaire maker|meia milha/i, f.id);
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
  assert.equal(LV.events[0].start, '2026-11-27T11:00');
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

test('a tournament the player adds: in the schedule, planned, reminded, startable; delete takes it out', () => {
  const e = ownEvent('fe_1', { name: ' Deepstack ', start: '2026-12-05T15:00', game: 'NLH', buyIn: 400, stack: 30000, levelMinutes: 30 }, 1);
  assert.equal(e.name, 'Deepstack');
  const plan = { ...EMPTY_PLAN, events: [e], picked: ['fe_1'], lateReg: { fe_1: 120 } };
  const all = withPlanEvents(F, plan);
  assert.equal(all.events.length, F.events.length + 1);
  assert.equal(withPlanEvents(all, plan).events.length, all.events.length);
  assert.deepEqual(planTotals(F, plan), { events: 1, entries: 1, buyIns: 400 });
  assert.equal(planReminders(F, plan, venueTime(F, '2026-12-01T00:00'))[0].url, 'sweatbook://festival?id=bahamas-dez-2026&event=fe_1');
  const now = plannedNow(F, plan, [], venueTime(F, '2026-12-05T14:00'))!;
  assert.equal(now.e.id, 'fe_1');
  assert.equal(now.action.kind, 'start');
  const gone = removeOwnEvent(plan, 'fe_1');
  assert.deepEqual([gone.events, gone.picked, gone.lateReg], [[], [], {}]);
});

test('November schedules: official rows only, start order, unique ids, Day 2s free and without a structure', () => {
  for (const f of [SAO_PAULO_NOV_2026, TORRELODONES_NOV_2026, LISBOA_NOV_2026, PRAGUE_DEC_2026, PUNTA_DEL_ESTE_DEC_2026, PUNTA_CANA_JAN_2027]) {
    assert.ok(FESTIVALS.includes(f), f.id);
    assert.equal(new Set(f.events.map((e) => e.id)).size, f.events.length, f.id);
    const starts = f.events.map((e) => e.start);
    assert.deepEqual([...starts].sort(), starts, f.id);
    for (const e of f.events) {
      if (e.day2) assert.ok(e.buyIn === 0 && !e.stack && e.flight?.startsWith('2'), `${f.id} ${e.id}`);
      else assert.ok(e.buyIn > 0, `${f.id} ${e.id}`);
      if (e.levelMinutes) assert.ok(e.stack, `${f.id} ${e.id}`);
    }
  }
  // Punta Cana: #1-#18; the Main's three flights each with its Day 2 the next day.
  const pc = PUNTA_CANA_JAN_2027;
  assert.deepEqual([...new Set(pc.events.map((e) => e.number))].sort((a, b) => a - b), Array.from({ length: 18 }, (_, i) => i + 1));
  assert.deepEqual(pc.events.filter((e) => e.number === 11).map((e) => e.flight), ['1A', '2A', '1B', '2B', '1C', '2C']);
  assert.deepEqual(festivalSpan(pc), { from: '2027-01-24', to: '2027-02-02' });
  // São Paulo: #1-#105, in the venue's time (UTC-3).
  const sp = SAO_PAULO_NOV_2026;
  assert.deepEqual([...new Set(sp.events.map((e) => e.number))].sort((a, b) => a - b), Array.from({ length: 105 }, (_, i) => i + 1));
  assert.equal(sp.events[0].start, '2026-11-13T12:00');
  assert.deepEqual(sp.events.filter((e) => e.number === 26 && !e.day2).map((e) => e.flight), ['1A', '1B', '1C', '1D', '1E', '1F', '1G', '1H', '1I', '1J']);
  assert.deepEqual(['buyIn', 'stack', 'levelMinutes'].map((k) => sp.events.find((e) => e.id === '26-1A')![k as 'buyIn']), [5000, 40000, 40]);
  assert.equal(venueTime(sp, '2026-11-16T12:00'), Date.UTC(2026, 10, 16, 15));
  assert.deepEqual(['start', 'levelMinutes'].map((k) => sp.events.find((e) => e.id === '94-1B')![k as 'start']), ['2026-11-27T20:00', 25]);
  // Torrelodones: the Low Cost flight has its own buy-in and structure.
  const lc = TORRELODONES_NOV_2026.events.find((e) => e.id === '6-1C')!;
  assert.deepEqual([lc.buyIn, lc.stack, lc.levelMinutes], [300, 25000, 20]);
  // Lisbon: #7 has its buy-in; the Turbo flight and the afternoon satellites have their own levels.
  assert.equal(LISBOA_NOV_2026.events.find((e) => e.id === '7')!.buyIn, 125);
  assert.deepEqual(['stack', 'levelMinutes'].map((k) => LISBOA_NOV_2026.events.find((e) => e.id === '2-1E')![k as 'stack']), [60000, 15]);
  assert.deepEqual(LISBOA_NOV_2026.events.filter((e) => e.name.startsWith('Satellite')).map((e) => e.levelMinutes), [30, 25, 30, 25, 30]);
  // Prague: the €1,100 Main Event's flights each have their own level length; the €5,300 one has no published levels.
  const pr = PRAGUE_DEC_2026.events;
  assert.deepEqual(pr.filter((e) => e.number === 1 && !e.day2).map((e) => e.levelMinutes), [40, 30, 40, 30, 30, 20]);
  assert.deepEqual(['buyIn', 'stack', 'levelMinutes'].map((k) => pr.find((e) => e.id === '27-1A')![k as 'buyIn']), [5300, 30000, undefined]);
  assert.equal(pr.find((e) => e.id === '55-1A')!.buyIn, 1650);
  // Satellite groups: one numbered event per published start.
  assert.deepEqual(pr.filter((e) => e.name === 'Satellite to #1 Main Event').map((e) => e.number), [2, 5, 7, 9, 11]);
  // Punta del Este: Main Event flights 1A-1E, Day 2 on 8 Dec (UTC-3).
  const pu = PUNTA_DEL_ESTE_DEC_2026.events.filter((e) => e.number === 8);
  assert.deepEqual(pu.map((e) => e.flight), ['1A', '1B', '1C', '1D', '1E', '2']);
  assert.deepEqual([pu[0].buyIn, pu[0].stack, pu[0].levelMinutes, pu[0].guarantee], [2750, 20000, 30, 750_000]);
});

test('sharing the plan: by day in start order, days/times/names only, buy-ins only when asked', () => {
  const plan = { ...EMPTY_PLAN, picked: ['10-1B', '85-1A', '10-2', '85-2'] };
  const days = planDays(LV, plan);
  assert.deepEqual(days.map((d) => d.day), ['2026-11-27', '2026-11-30', '2026-12-14', '2026-12-16']);
  assert.deepEqual(days[0].rows.map((r) => [r.time, r.flight]), [['11:00', 'Flight 1A']]);
  const text = planText(LV, plan, 'https://x.test/r/abc');
  assert.match(text, /Las Vegas, dezembro 2026/);
  assert.match(text, /11:00 · No Limit Hold'em · Flight 1A/);
  assert.match(text, /Main Event · Dia 2/);
  assert.match(text, /https:\/\/x\.test\/r\/abc$/);
  assert.doesNotMatch(text, /\$|10[ .,]?400|600/);
  assert.match(planText(LV, plan, 'l', { buyIns: true }), /Flight 1A · \$600|Flight 1A · 600/);
  // The story keeps what fits and counts the rest.
  const many = Array.from({ length: 5 }, (_, i) => ({ day: `d${i}`, label: `d${i}`, rows: Array.from({ length: 4 }, (_, j) => ({ id: `${i}-${j}`, time: '12:00', title: 'x', flight: '', buyIn: '' })) }));
  const fit = fitPlan(many, 15);
  assert.equal(fit.days.reduce((n, d) => n + 1 + d.rows.length, 0), 15);
  assert.equal(fit.more, 20 - fit.days.reduce((n, d) => n + d.rows.length, 0));
});

test('a session for a planned event runs its level clock from the published start, never before', () => {
  const e = TORRELODONES_NOV_2026.events.find((x) => x.id === '1-1C')!;
  const start = venueTime(TORRELODONES_NOV_2026, e.start); // 17:00 in Madrid
  assert.equal(levelStart(TORRELODONES_NOV_2026, e, start - 25 * 60_000), start);
  assert.equal(levelStart(TORRELODONES_NOV_2026, e, start + 10 * 60_000), start + 10 * 60_000);
  // The festival runs to the 23rd although its last row is the 22nd.
  assert.deepEqual(festivalSpan(TORRELODONES_NOV_2026), { from: '2026-11-12', to: '2026-11-23' });
});

test('schedule filters: satellites, turbo and deep by name or flight; a buy-in cap keeps a Day 2 with its Day 1', () => {
  assert.equal(LV.events.filter((e) => isKind(e, 'sat')).length, 25);
  assert.ok(isKind(LV.events.find((e) => e.flight === '1B Turbo')!, 'turbo'));
  assert.ok(SAO_PAULO_NOV_2026.events.some((e) => isKind(e, 'deep')));
  const me2 = LV.events.find((e) => e.name === 'Main Event' && e.day2)!;
  assert.equal(entryBuyIn(LV, me2), 10400);
  const caps = buyInCaps(LV);
  assert.ok(caps.length >= 2 && caps.every((c, i) => i === 0 || c > caps[i - 1]));
});

test('clashes: overlapping planned events warn on both rows; flights of one tournament do not', () => {
  // Main Event Day 2 (16 Dec 12:00) and the $1,100 NLH 1A (16 Dec 11:00).
  const me2 = LV.events.find((e) => e.name === 'Main Event' && e.day2)!;
  const nlh = LV.events.find((e) => e.id === '19-1A')!;
  const c = clashes(LV, { ...EMPTY_PLAN, picked: [me2.id, nlh.id] });
  assert.equal(c.get(me2.id)?.id, nlh.id);
  assert.equal(c.get(nlh.id)?.id, me2.id);
  // 1A and 1B of the Main Event are alternatives.
  assert.equal(clashes(LV, { ...EMPTY_PLAN, picked: ['10-1A', '10-1B'] }).size, 0);
  // Events on different days don't clash.
  assert.equal(clashes(LV, { ...EMPTY_PLAN, picked: ['85-1A', '10-1A'] }).size, 0);
});

test('late reg: the organiser\'s close time sets the reminder until the player picks their own', () => {
  const base = F.events.find((e) => e.id === '12-A')!;
  const G = { ...F, events: F.events.map((e) => (e.id === '12-A' ? { ...e, lateRegMin: 330 } : e)) };
  const start = venueTime(F, base.start);
  const late = (p: typeof EMPTY_PLAN) => planReminders(G, p, 0).find((x) => x.id.endsWith('12-A:late'))!.at;
  const plan = { ...EMPTY_PLAN, picked: ['12-A'] };
  assert.equal(lateRegOf(plan, G.events.find((e) => e.id === '12-A')!), 330);
  assert.equal(late(plan), start + (330 - 20) * 60_000);
  assert.equal(late({ ...plan, lateReg: { '12-A': 120 } }), start + (120 - 20) * 60_000);
  // No official time and none picked: no late reminder.
  assert.ok(!planReminders(F, plan, 0).some((x) => x.id.endsWith(':late')));
});

test('Punta del Este Main: the official 00:30 close fills late reg and its reminder', () => {
  const f = PUNTA_DEL_ESTE_DEC_2026;
  const e = f.events.find((x) => x.id === '8-1A')!;
  const plan = { ...EMPTY_PLAN, picked: ['8-1A'] };
  const r = planReminders(f, plan, 0).find((x) => x.id.endsWith(':late'))!;
  assert.equal(r.at, venueTime(f, '2026-12-05T00:10'));
  assert.equal(r.title, 'Registo do #8 Main Event · Flight 1A fecha às 00:30');
  assert.equal(lateRegOf(plan, e), 270);
});

const mtt = (id: string, startedAt: number, extra: object = {}) =>
  ({ id, kind: 'mtt' as const, name: '', venue: '', currency: '$', startedAt, breaks: [], buyIn: 2750, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb' as const, tableSize: 8, stack: 20000, stackLog: [], roster: [], notes: '', ...extra });

test('after a festival session: re-entry while late reg is open, then the next planned event', () => {
  const f = PUNTA_DEL_ESTE_DEC_2026;
  const s = mtt('s', venueTime(f, '2026-12-04T20:00'));
  const plans = { [f.id]: { ...EMPTY_PLAN, picked: ['8-1A', '8-1C', '13'], sessions: { '8-1A': 's' } } };
  // Busted at 22:00: late reg (official, 00:30) still open; the next planned is 13 the next day, not startable yet.
  const a = afterSession(FESTIVALS, plans, [s], s, venueTime(f, '2026-12-04T22:00'))!;
  assert.equal(a.e.id, '8-1A');
  assert.equal(a.reenterUntil, venueTime(f, '2026-12-05T00:30'));
  assert.deepEqual([a.next!.e.id, a.next!.now], ['13', false]);
  // After late reg: no re-entry here.
  assert.equal(afterSession(FESTIVALS, plans, [s], s, venueTime(f, '2026-12-05T01:00'))!.reenterUntil, undefined);
  // Within 2 h of a later flight of the same event: it's next, and starts straight away (as a re-entry).
  const b = afterSession(FESTIVALS, { [f.id]: { ...plans[f.id], picked: ['8-1A', '8-1C'] } }, [s], s, venueTime(f, '2026-12-06T19:00'))!;
  assert.deepEqual([b.next!.e.id, b.next!.now], ['8-1C', true]);
  // A session from no plan: nothing.
  assert.equal(afterSession(FESTIVALS, plans, [s], mtt('other', 0), 0), null);
});

test('after bagging: the Day 2 that takes this flight', () => {
  const pc = PUNTA_CANA_JAN_2027;
  const s = mtt('pc', venueTime(pc, '2027-01-29T13:00'), { bag: { stack: 90000, at: 0 }, endedAt: 1 });
  const a = afterSession(FESTIVALS, { [pc.id]: { ...EMPTY_PLAN, picked: ['11-1B'], sessions: { '11-1B': 'pc' } } }, [s], s, venueTime(pc, '2027-01-29T23:00'))!;
  assert.deepEqual([a.day2!.e.id, a.day2!.planned, a.next], ['11-2B', false, undefined]);
  // Torrelodones: flight 1C goes to Day 2A, 1E to Day 2B.
  const tr = TORRELODONES_NOV_2026;
  const t1 = mtt('t1', venueTime(tr, '2026-11-19T20:00'), { bag: { stack: 1, at: 0 }, endedAt: 1 });
  const at = venueTime(tr, '2026-11-21T08:00');
  assert.equal(afterSession(FESTIVALS, { [tr.id]: { ...EMPTY_PLAN, sessions: { '6-1C': 't1' } } }, [t1], t1, at)!.day2!.e.id, '6-2A');
  assert.equal(afterSession(FESTIVALS, { [tr.id]: { ...EMPTY_PLAN, sessions: { '6-1E': 't1' } } }, [t1], t1, at)!.day2!.e.id, '6-2B');
  // And Day 2B resumes a session bagged in 1E (the planner's "Começar Dia 2").
  const plan = { ...EMPTY_PLAN, sessions: { '6-1E': 't1' } };
  assert.equal(eventAction(tr, plan, [t1], tr.events.find((e) => e.id === '6-2B')!)?.kind, 'resume');
  assert.equal(eventAction(tr, plan, [t1], tr.events.find((e) => e.id === '6-2A')!), null);
});
