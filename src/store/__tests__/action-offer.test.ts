/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BAHAMAS_DEC_2026 as F, venueTime } from '../../poker/festivals';
import { agreement, lineCost, lineRecords, lineSettlement, missedRefund, nextEventFor, settleReminders, usualTerms, unanswered, newOffer, offerEvents, offerPackageIds, offerTotals, pendingCost, stakesFor, withOfferStakes, type ActionOffer } from '../action-offer';
import type { Session } from '../types';

// Event 2 ($26,000), event 3 ($50,000), and a Day 2 that has no buy-in.
const picked = ['2', '3', '12-2A'];

test('a new package has the picked events, never a Day 2, and no backers yet', () => {
  const o = newOffer(F, picked, 'o1', 1);
  assert.deepEqual(o.events, ['2', '3']);
  assert.deepEqual(offerEvents(F, o).map((e) => e.id), ['2', '3']);
  assert.equal(o.lines.length, 0);
});

const pkg = (lines: ActionOffer['lines'], markup = 1.2): ActionOffer => ({ ...newOffer(F, picked, 'o1', 1), markup, lines });

test('totals: what backers pay, what the player keeps and puts in', () => {
  const o = pkg([
    { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 },
    { id: 'l2', backerId: 'b2', packageId: 'p2', pct: 5 },
  ]);
  const t = offerTotals(F, o);
  assert.equal(t.buyIns, 76000);
  assert.equal(t.sold, 15);
  assert.equal(t.price, 13680);
  assert.equal(t.premium, 2280);
  assert.equal(t.outOfPocket, 76000 - 13680);
  assert.equal(t.keep, 85);
  assert.equal(lineCost(F, o, 10), 9120);
});

test("a backer's private link carries only their own piece, no venue or other backers", () => {
  const o = pkg([
    { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 },
    { id: 'l2', backerId: 'b2', packageId: 'p2', pct: 5 },
  ]);
  const p = agreement(F, o, o.lines[1], '  Rui  ', 'Marta', 'Festival de dezembro', 5);
  assert.equal(p.player, 'Rui');
  assert.equal(p.backer, 'Marta');
  assert.deepEqual(p.events.map((e) => [e.b, e.p]), [[26000, 5], [50000, 5]]);
  const json = JSON.stringify(p);
  for (const leak of ['Baha Mar', 'b1', 'p1', '"10"']) assert.ok(!json.includes(leak), leak);
});

test('a new line reuses the backer with the same name and makes a staking package', () => {
  const o = pkg([], 1.15);
  const mine = [{ id: 'b9', name: ' Marta ', note: '', createdAt: 0 }];
  const a = lineRecords('marta', mine, 'Festival', o, 5, { line: 'l', backer: 'nb', pkg: 'np' }, 3);
  assert.equal(a.isNew, false);
  assert.equal(a.line.backerId, 'b9');
  assert.deepEqual([a.pkg.share, a.pkg.markup, a.pkg.kind], [5, 1.15, 'action']);
  assert.equal(lineRecords('Ana', mine, 'Festival', o, 5, { line: 'l', backer: 'nb', pkg: 'np' }).isNew, true);
});

test('sessions from the package events carry each backer, unpaid until marked paid', () => {
  const o = pkg([
    { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10, paid: true },
    { id: 'l2', backerId: 'b2', packageId: 'p2', pct: 5 },
  ]);
  assert.deepEqual(stakesFor([o], F.id, '2'), [
    { backerId: 'b1', packageId: 'p1', share: 10, markup: 1.2, unpaid: undefined },
    { backerId: 'b2', packageId: 'p2', share: 5, markup: 1.2, unpaid: true },
  ]);
  assert.deepEqual(stakesFor([o], F.id, '1-A'), []);
  assert.deepEqual(stakesFor([o], 'other', '2'), []);
  // Re-applying replaces the package's own stakes and keeps the ones added by hand.
  const byHand = { backerId: 'x', share: 5, markup: 1 };
  const next = withOfferStakes([byHand, { backerId: 'b1', packageId: 'p1', share: 99, markup: 1 }], stakesFor([o], F.id, '3'), offerPackageIds([o]));
  assert.equal(next.length, 3);
  assert.deepEqual(next[0], byHand);
});

const BEFORE = Date.UTC(2026, 9, 17);
const AFTER = Date.UTC(2026, 11, 20);

test('an unpaid piece is owed before any session, and moves to the sessions as they start', () => {
  const line = { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 };
  const o = pkg([line], 1.2);
  // 10% of (26,000 + 50,000) × 1.2
  assert.equal(pendingCost(F, o, line, {}), 9120);
  // Event 2 started: its stake (unpaid) now carries it, only event 3 is left here.
  assert.equal(pendingCost(F, o, line, { '2': 's1' }), 6000);
  assert.equal(pendingCost(F, o, { ...line, paid: true }, {}), 0);
});

const session = (id: string, cashOut: number | null, stakes: Session['stakes'], buyIn = 26000): Session =>
  ({ id, kind: 'mtt', name: '', venue: '', currency: '$', startedAt: 1, endedAt: cashOut === null ? null : 2, breaks: [], buyIn, entries: 1, addOn: 0, cashOut: cashOut ?? 0, stakes }) as unknown as Session;

test('an event gone by with no session is asked about, never assumed not played', () => {
  const line = { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 };
  const o = pkg([line], 1.2);
  // Event 2 played; event 3 has no session: still charged, and the player is asked.
  assert.equal(pendingCost(F, o, line, { '2': 's1' }), 6000);
  assert.deepEqual(unanswered(F, o, { '2': 's1' }, AFTER).map((e) => e.id), ['3']);
  assert.deepEqual(unanswered(F, o, { '2': 's1' }, BEFORE), []);
  assert.equal(missedRefund(F, o, { ...line, paid: true }, { '2': 's1' }), 0);
  // "Não joguei": not charged, and a paid piece of it goes back.
  const said = { ...o, skipped: ['3'] };
  assert.deepEqual(unanswered(F, said, { '2': 's1' }, AFTER), []);
  assert.equal(pendingCost(F, said, line, { '2': 's1' }), 0);
  assert.equal(missedRefund(F, said, { ...line, paid: true }, { '2': 's1' }), 6000);
  // A session logged later wins over the answer.
  assert.equal(missedRefund(F, said, { ...line, paid: true }, { '2': 's1', '3': 's2' }), 0);
});

test("festival settlement: the backer's prizes, less a piece not paid, plus refunds", () => {
  const line = { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 };
  const o = pkg([line], 1.2);
  const stake = (paid: boolean) => [{ backerId: 'b1', packageId: 'p1', share: 10, markup: 1.2, unpaid: paid ? undefined : true }];
  // Unpaid; event 2 cashed for 100,000, event 3 still to come.
  const a = lineSettlement(F, o, line, { '2': 's1' }, [session('s1', 100000, stake(false))], BEFORE);
  assert.deepEqual(a.rows.map((r) => r.state), ['cashed', 'upcoming']);
  assert.deepEqual([a.prizes, a.cost, a.refund, a.net, a.done], [10000, 9120, 0, 880, false]);
  // Paid; event 2 busted, event 3 gone by with no answer yet: waiting, nothing settled.
  const w = lineSettlement(F, o, { ...line, paid: true }, { '2': 's1' }, [session('s1', 0, stake(true))], AFTER);
  assert.deepEqual(w.rows.map((r) => r.state), ['busted', 'waiting']);
  assert.deepEqual([w.refund, w.net, w.done, w.waiting], [0, 0, false, 1]);
  // The player said they didn't play event 3: their event 3 money goes back.
  const b = lineSettlement(F, { ...o, skipped: ['3'] }, { ...line, paid: true }, { '2': 's1' }, [session('s1', 0, stake(true))], AFTER);
  assert.deepEqual(b.rows.map((r) => r.state), ['busted', 'missed']);
  assert.deepEqual([b.prizes, b.cost, b.refund, b.net, b.done], [0, 3120, 6000, 6000, true]);
  // A session still running.
  const c = lineSettlement(F, o, line, { '2': 's1' }, [session('s1', null, stake(false))], BEFORE);
  assert.deepEqual([c.live, c.upcoming, c.net], [1, 1, -9120]);
});

test('settlement reminders: the next unanswered event per package at 13:00, one a day at most', () => {
  const line = { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 };
  const o = pkg([line]);
  const r = settleReminders([{ f: F, o, started: {} }], BEFORE);
  assert.equal(r.length, 1);
  assert.equal(r[0].eventId, '2');
  const at = new Date(r[0].at);
  assert.deepEqual([at.getHours(), at.getMinutes()], [13, 0]);
  // A day after event 2's start at the earliest.
  assert.ok(r[0].at >= venueTime(F, offerEvents(F, o)[0].start) + 24 * 3600e3);
  // Event 2 played: event 3 is next. Answered, or no backers: nothing.
  assert.equal(settleReminders([{ f: F, o, started: { '2': 's1' } }], BEFORE)[0].eventId, '3');
  assert.deepEqual(settleReminders([{ f: F, o: { ...o, skipped: ['2', '3'] }, started: {} }], BEFORE), []);
  assert.deepEqual(settleReminders([{ f: F, o: pkg([]), started: {} }], BEFORE), []);
  // Two packages due the same day: one reminder.
  assert.equal(settleReminders([{ f: F, o, started: {} }, { f: F, o: { ...o, id: 'o2' }, started: {} }], BEFORE).length, 1);
  // Overdue and never reminded: the next 13:00. Once reminded and gone by: not repeated.
  const late = settleReminders([{ f: F, o, started: {} }], AFTER);
  assert.equal(late[0].eventId, '2');
  // At or after now: in a zone where AFTER is 13:00 on the dot (Auckland), it's now.
  assert.ok(late[0].at >= AFTER && late[0].at - AFTER <= 24 * 3600e3);
  const sent = { 'o1:2': AFTER - 1, 'o1:3': AFTER - 1 };
  assert.deepEqual(settleReminders([{ f: F, o, started: {} }], AFTER, sent), []);
});

test("a backer's next event: the first of their package not started, skipped or gone by", () => {
  const o = pkg([{ id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 }]);
  const [e2, e3] = offerEvents(F, o);
  const before = venueTime(F, e2.start) - 3600e3;
  assert.equal(nextEventFor([F], [o], 'b1', () => ({}), before)?.s, e2.start);
  assert.equal(nextEventFor([F], [o], 'b1', () => ({ '2': 's1' }), before)?.s, e3.start);
  assert.equal(nextEventFor([F], [{ ...o, skipped: ['2'] }], 'b1', () => ({}), before)?.s, e3.start);
  assert.equal(nextEventFor([F], [o], 'b1', () => ({}), venueTime(F, e3.start) + 1), null);
  assert.equal(nextEventFor([F], [o], 'b2', () => ({}), before), null);
});

test("a backer's usual terms: their newest piece, from a festival package or sold on its own", () => {
  const pkgOld = { id: 'p1', backerId: 'b1', name: 'Lisboa', kind: 'action' as const, share: 10, markup: 1.15, playerCut: 0, createdAt: 100 };
  const loose = { id: 's1', startedAt: 200, stakes: [{ backerId: 'b1', share: 7.5, markup: 1.1 }] } as unknown as Session;
  const pkgNew = { ...pkgOld, id: 'p2', share: 12.5, markup: 1.2, createdAt: 300 };
  assert.equal(usualTerms('b1', [], []), null);
  assert.deepEqual(usualTerms('b1', [pkgOld], []), { pct: 10, markup: 1.15 });
  assert.deepEqual(usualTerms('b1', [pkgOld], [loose]), { pct: 7.5, markup: 1.1 });
  assert.deepEqual(usualTerms('b1', [pkgOld, pkgNew], [loose]), { pct: 12.5, markup: 1.2 });
  // Makeup deals and other backers don't count.
  assert.equal(usualTerms('b1', [{ ...pkgNew, kind: 'makeup' as const }], []), null);
  assert.equal(usualTerms('b2', [pkgOld], [loose]), null);
});

