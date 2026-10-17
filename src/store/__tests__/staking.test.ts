/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { liveSnapshot, snapshotKey } from '../../lib/live-link';
import { owedToBackers, profit, soldShare, stakeIn, stakingSummary, totals } from '../session-math';
import { backerLedger, packageStates, pieceSteps, stakingTotals, withCuts } from '../staking';
import type { BackerPayment, Session, StakePackage } from '../types';

let n = 0;
function mk(over: Partial<Session> = {}): Session {
  n++;
  return {
    id: 's' + n, kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: n * 1000, endedAt: n * 1000 + 500, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

const pkg = (over: Partial<StakePackage> = {}): StakePackage => ({
  id: 'p1', backerId: 'b1', name: 'Pacote', kind: 'makeup', share: 100, markup: 1, playerCut: 50, createdAt: 0, ...over,
});

test('named stakes add up like the old % sold', () => {
  const s = mk({ buyIn: 1000, cashOut: 10000, stakes: [{ backerId: 'a', share: 30, markup: 1.2 }, { backerId: 'b', share: 20, markup: 1.2 }] });
  const old = mk({ buyIn: 1000, cashOut: 10000, staking: { sold: 50, markup: 1.2 } });
  assert.equal(soldShare(s), 0.5);
  assert.equal(owedToBackers(s), owedToBackers(old));
  assert.equal(stakeIn(s), stakeIn(old));
  assert.equal(profit(s), profit(old));
  assert.deepEqual(stakingSummary(s.stakes!), { sold: 50, markup: 1.2 });
});

test('different markups per backer', () => {
  const s = mk({ buyIn: 1000, stakes: [{ share: 10, markup: 1 }, { share: 10, markup: 1.5 }] });
  assert.equal(stakeIn(s), 100 + 150);
  assert.deepEqual(stakingSummary(s.stakes!), { sold: 20, markup: 1.25 });
});

test('oversold is scaled to 100%', () => {
  const s = mk({ buyIn: 1000, cashOut: 2000, stakes: [{ share: 80, markup: 1 }, { share: 80, markup: 1 }] });
  assert.equal(soldShare(s), 1);
  assert.equal(owedToBackers(s), 2000);
  assert.equal(stakeIn(s), 1000);
});

test('makeup package: losses carry over, cut only on profit above makeup', () => {
  const p = pkg();
  const stake = { backerId: 'b1', packageId: 'p1', share: 100, markup: 1 };
  const a = mk({ cashOut: 0, stakes: [stake] }); // backer -100
  const b = mk({ cashOut: 0, stakes: [stake] }); // -200
  const c = mk({ cashOut: 500, stakes: [stake] }); // +400 → total +200
  const { states, cuts } = packageStates([a, b, c], [p]);
  const st = states.get('p1')!;
  assert.equal(st.net, 200);
  assert.equal(st.makeup, 0);
  assert.equal(st.cut, 100);
  assert.equal(cuts.get(a.id), 0);
  assert.equal(cuts.get(c.id), 100);
  // Fully staked: your own result is just the cut.
  const synced = withCuts([a, b, c], [p]);
  assert.equal(profit(synced[0]), 0);
  assert.equal(profit(synced[2]), 100);
  assert.equal(totals(synced).profit, 100);
  // Unchanged sessions keep their identity; an already synced list comes back as is.
  assert.equal(synced[0], a);
  assert.deepEqual(withCuts(synced, [p]), synced);
  assert.equal(withCuts(synced, [p])[2], synced[2]);

  // After two busts only, the backer is 200 in makeup and you have earned nothing.
  const two = packageStates([a, b], [p]).states.get('p1')!;
  assert.equal(two.makeup, 200);
  assert.equal(two.cut, 0);
});

test('a later loss takes back cut already credited', () => {
  const p = pkg();
  const stake = { backerId: 'b1', packageId: 'p1', share: 100, markup: 1 };
  const win = mk({ cashOut: 300, stakes: [stake] }); // +200 → cut 100
  const bust = mk({ cashOut: 0, stakes: [stake] }); // -100 → total +100 → cut 50
  const { cuts, states } = packageStates([win, bust], [p]);
  assert.equal(cuts.get(win.id), 100);
  assert.equal(cuts.get(bust.id), -50);
  assert.equal(states.get('p1')!.cut, 50);
});

test('backer ledger: owed, unpaid pieces, payments and balance', () => {
  const sold = mk({ buyIn: 1000, cashOut: 5000, stakes: [{ backerId: 'b1', share: 20, markup: 1.1 }] });
  const unpaid = mk({ buyIn: 1000, cashOut: 0, stakes: [{ backerId: 'b1', share: 10, markup: 1, unpaid: true }] });
  const other = mk({ cashOut: 9999, stakes: [{ backerId: 'b2', share: 50, markup: 1 }] });
  const running = mk({ endedAt: undefined, stakes: [{ backerId: 'b1', share: 10, markup: 1 }] });
  const pay: BackerPayment[] = [{ id: 'x', backerId: 'b1', amount: 600, at: 0, note: '', createdAt: 0 }];
  const l = backerLedger('b1', [sold, unpaid, other, running], [], pay);
  assert.equal(l.rows.length, 3);
  assert.equal(l.live, 1);
  assert.equal(l.invested, 220 + 100 + 10);
  // Prize share 1000; they still owe 100 for the unpaid piece; you paid them 600.
  assert.equal(l.balance, 1000 - 100 - 600);
  assert.equal(Math.round(l.result), 1000 - 220 - 100);
  const u = pieceSteps(l.rows.find((r) => r.session === unpaid)!);
  assert.equal(u.balance, -100);
});

test('backer ledger takes your makeup cut out of what they get back', () => {
  const p = pkg({ share: 50, playerCut: 40 });
  const s = mk({ buyIn: 1000, cashOut: 3000, stakes: [{ backerId: 'b1', packageId: 'p1', share: 50, markup: 1 }] });
  // Backer: paid 500, prize share 1500, net +1000; your cut 40% = 400.
  const l = backerLedger('b1', [s], [p], []);
  assert.equal(l.rows[0].owed, 1100);
  assert.equal(l.balance, 1100);
  // The settlement adds up step by step.
  assert.equal(l.prizes, 1500);
  assert.equal(l.cut, 400);
  assert.equal(l.prizes - l.cut - l.unpaid - l.paid, l.balance);
  const st = pieceSteps(l.rows[0]);
  assert.equal(st.piece, 0.5);
  assert.equal(st.cost, st.piece * st.buyIns * st.markup);
  assert.equal(st.prize, st.piece * st.prizeTotal);
  assert.equal(st.owed, st.prize - st.cut);
  assert.equal(st.net, 600);
  // You: 3000 - 1500 - (1000 - 500) + 400.
  assert.equal(profit(withCuts([s], [p])[0]), 1400);
});

test('live snapshot: only what backers need, clock changes are not an update', () => {
  const s = mk({ endedAt: undefined, notes: 'secret read on seat 3', roster: ['Zé'], stackLog: Array.from({ length: 200 }, (_, i) => ({ t: i, stack: i })), stakes: [{ backerId: 'b1', share: 25, markup: 1.1 }] });
  const a = liveSnapshot(s, 'Rui', 3, 10_000);
  const json = JSON.stringify(a);
  assert.ok(!json.includes('secret'));
  assert.ok(!json.includes('Zé'));
  assert.ok(!json.includes('b1'));
  assert.equal(a.stackLog.length, 120);
  assert.equal(a.sold, 25);
  assert.equal(a.cashOut, 0);
  // Where the player is stays off the page unless they show it.
  assert.equal(a.venue, '');
  assert.equal(liveSnapshot({ ...s, live: { id: 'x', token: 'y', showVenue: true } }, 'Rui', 3).venue, s.venue);
  assert.equal(snapshotKey(a), snapshotKey(liveSnapshot(s, 'Rui', 3, 99_000)));
  assert.notEqual(snapshotKey(a), snapshotKey(liveSnapshot({ ...s, stack: 1 }, 'Rui', 3, 10_000)));
});

test('the live link says when a tournament day is bagged, and which day', () => {
  const s = mk({ day: 1, endedAt: 9_000, bag: { stack: 72_500, at: 9_000 }, stack: 72_500 });
  const a = liveSnapshot(s, 'Rui', 0, 10_000);
  assert.equal(a.bagged, true);
  assert.equal(a.day, 1);
  assert.equal(a.stack, 72_500);
  const d2 = liveSnapshot(mk({ day: 2, endedAt: undefined }), 'Rui', 0, 10_000);
  assert.deepEqual([d2.bagged, d2.day], [false, 2]);
});

// QA: home currency €, a backing on $ sessions showed "Deves 14 508€".
const fxTable = { '2026-12-03': { USD: 1.1 }, '2026-10-17': { USD: 1.25 } };
const usd = (over: Partial<Session> = {}) =>
  mk({ currency: '$', startedAt: Date.UTC(2026, 11, 3), endedAt: Date.UTC(2026, 11, 4), stakes: [{ backerId: 'b1', share: 50, markup: 1 }], ...over });

test('a $ deal stays in $ when the home currency is €', () => {
  const l = backerLedger('b1', [usd({ buyIn: 1000, cashOut: 30016 })], [], [], undefined, { table: fxTable, fallback: '€' });
  assert.equal(l.currency, '$');
  assert.equal(Math.round(l.balance), 15008);
  const tot = stakingTotals([l], '€', fxTable, {}, Date.UTC(2026, 9, 17));
  assert.equal(tot.currency, '$');
  assert.equal(Math.round(tot.owe), 15008);
  assert.equal(tot.approx, false);
});

test("sessions in another currency count at their day's rate in the deal's currency", () => {
  const eur = usd({ currency: '€', buyIn: 100 });
  const l = backerLedger('b1', [usd({ buyIn: 1000 }), eur], [], [], undefined, { table: fxTable, fallback: '€' });
  assert.equal(l.currency, '$');
  // 500$ + 50€ × 1.1
  assert.equal(Math.round(l.invested * 100) / 100, 555);
  const none = backerLedger('b1', [usd({ buyIn: 1000 }), eur], [], [], undefined, { table: {}, fallback: '€' });
  assert.deepEqual(none.missing, ['€']);
});

test("backers in different currencies add up in the home one at today's rate, or stay split without a rate", () => {
  const a = { ...backerLedger('x', [], [], []), currency: '$', balance: 1250 };
  const b = { ...backerLedger('x', [], [], []), currency: '€', balance: 100 };
  const now = Date.UTC(2026, 9, 17);
  const tot = stakingTotals([a, b], '€', fxTable, {}, now);
  assert.equal(tot.currency, '€');
  assert.equal(Math.round(tot.owe), 1100);
  assert.equal(tot.approx, true);
  assert.equal(tot.oweTo, 2);
  const split = stakingTotals([a, b], '€', {}, {}, now);
  assert.deepEqual(split.split?.map((x) => x.currency).sort(), ['$', '€']);
});
