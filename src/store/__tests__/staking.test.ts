/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { liveSnapshot, snapshotKey } from '../../lib/live-link';
import { owedToBackers, profit, soldShare, stakeIn, stakingSummary, totals } from '../session-math';
import { sessionsCsv } from '../backup';
import { addOfferDue, backerLedger, carriedTo, closePackage, endPreview, keepCuts, lastStakeTerms, ledgerYears, packageDefaults, packageStates, yearStatement, pieceSteps, stakingTotals, withCuts } from '../staking';
import type { BackerPayment, Session, StakePackage } from '../types';
import { fixSession } from '../validate';

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
  mk({ currency: '$', startedAt: Date.UTC(2026, 11, 3, 12), endedAt: Date.UTC(2026, 11, 4, 12), stakes: [{ backerId: 'b1', share: 50, markup: 1 }], ...over });

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

test('a balance in cents still counts: 0,40 owed is not settled, half a cent of rounding is', () => {
  const owe = { ...backerLedger('x', [], [], []), currency: '€', balance: 0.4 };
  const dust = { ...backerLedger('y', [], [], []), currency: '€', balance: -0.004 };
  const tot = stakingTotals([owe, dust], '€', {}, {});
  assert.equal(tot.oweTo, 1);
  assert.equal(tot.owedBy, 0);
  assert.equal(Math.round(tot.owe * 100), 40);
});

test('closing with makeup: forgive it, or carry it to a new package where it is won back first', () => {
  const p = pkg();
  const stake = { backerId: 'b1', packageId: 'p1', share: 100, markup: 1 };
  const bust = mk({ cashOut: 0, stakes: [stake] }); // makeup 100
  assert.equal(packageStates([bust], [p]).states.get('p1')!.makeup, 100);
  const forgiven = closePackage(p, 100, false, 'p2', 5);
  assert.equal(forgiven.closed.closedAt, 5);
  assert.equal(forgiven.next, null);
  const { closed, next } = closePackage(p, 100, true, 'p2', 5);
  assert.deepEqual([closed.closedAt, next!.id, next!.makeupIn, next!.playerCut, next!.share], [5, 'p2', 100, 50, 100]);
  // Numbered so the two stay apart in the list.
  assert.equal(next!.name, `${p.name} (2)`);
  assert.equal(closePackage(next!, 100, true, 'p3', 6).next!.name, `${p.name} (3)`);
  // In the new package a 250 win first pays back the 100 carried: cut on 150 only.
  const win = mk({ buyIn: 100, cashOut: 350, stakes: [{ ...stake, packageId: 'p2' }] }); // +250
  const st = packageStates([win], [next!]).states.get('p2')!;
  assert.equal(st.cut, 75);
  assert.equal(st.net, 250);
  assert.equal(st.makeup, 0);
  // A loss on top of it: carried 100 + 100 = 200 makeup.
  const loss = mk({ cashOut: 0, stakes: [{ ...stake, packageId: 'p2' }] });
  assert.equal(packageStates([loss], [next!]).states.get('p2')!.makeup, 200);
  // Nothing to carry, or an action package: no new package.
  assert.equal(closePackage(p, 0, true, 'p2').next, null);
  assert.equal(closePackage({ ...p, kind: 'action' }, 100, true, 'p2').next, null);
});

test("a backer's year: package by package, sessions counted in the year they started", () => {
  const mkp = pkg({ id: 'pm', name: 'Série', share: 50, playerCut: 50, createdAt: 1 });
  const act = pkg({ id: 'pa', name: 'Festival', kind: 'action', share: 10, markup: 1.2, playerCut: 0, createdAt: 2 });
  const y26 = new Date(2026, 5, 1).getTime();
  const y25 = new Date(2025, 5, 1).getTime();
  const sessions = [
    mk({ startedAt: y26, endedAt: y26 + 1, buyIn: 1000, cashOut: 0, stakes: [{ backerId: 'b1', packageId: 'pm', share: 50, markup: 1 }] }),
    mk({ startedAt: y26 + 2, endedAt: y26 + 3, buyIn: 1000, cashOut: 5000, stakes: [{ backerId: 'b1', packageId: 'pa', share: 10, markup: 1.2 }] }),
    mk({ startedAt: y26 + 4, endedAt: undefined, buyIn: 500, cashOut: 0, stakes: [{ backerId: 'b1', share: 20, markup: 1 }] }),
    mk({ startedAt: y25, endedAt: y25 + 1, buyIn: 1000, cashOut: 0, stakes: [{ backerId: 'b1', packageId: 'pm', share: 50, markup: 1 }] }),
  ];
  const packages = [mkp, act];
  const pk = packageStates(sessions, packages);
  const l = backerLedger('b1', sessions, packages, [], pk);
  assert.deepEqual(ledgerYears(l), [2026, 2025]);
  const y = yearStatement(l, 2026, packages, pk);
  assert.deepEqual(y.rows.map((r) => [r.name, r.sessions, r.cost, r.prizes, r.net]), [
    ['Série', 1, 500, 0, -500],
    ['Festival', 1, 120, 500, 380],
    // Outside a package, still running: its cost counts, no result yet.
    ['', 1, 100, 0, 0],
  ]);
  // The makeup package is open with 1000 to win back (two busts at 500, across both years).
  assert.equal(y.rows[0].makeup, 1000);
  assert.deepEqual([y.sessions, y.cost, y.prizes, y.net, y.makeup], [3, 720, 500, -120, 1000]);
  assert.equal(yearStatement(l, 2025, packages, pk).sessions, 1);
});

test('a package with sessions in two currencies counts its makeup in its own, at each day rate', () => {
  const p = pkg({ id: 'px' });
  const x = { backerId: 'b1', packageId: 'px', share: 100, markup: 1 };
  const eur = mk({ buyIn: 100, cashOut: 0, stakes: [x] }); // −100€
  const usdLoss = mk({ currency: '$', buyIn: 200, cashOut: 0, stakes: [x] }); // −200$ = −100€
  const usdWin = mk({ currency: '$', buyIn: 200, cashOut: 1000, stakes: [x] }); // +800$ = +400€
  const table = { [new Date(0).toISOString().slice(0, 10)]: { USD: 2 } };
  const two = packageStates([eur, usdLoss], [p], { table }).states.get('px')!;
  assert.deepEqual([two.currency, two.makeup, two.unconverted], ['€', 200, 0]);
  const all = packageStates([eur, usdLoss, usdWin], [p], { table });
  const st = all.states.get('px')!;
  assert.deepEqual([st.makeup, st.net, st.cut], [0, 200, 100]);
  // Your cut on that session in its own currency: 100€ = 200$.
  assert.equal(all.cuts.get(usdWin.id), 200);
  // No rate yet (offline): the dollar sessions stay out instead of being added as euros.
  const off = packageStates([eur, usdLoss], [p]).states.get('px')!;
  assert.deepEqual([off.makeup, off.unconverted], [100, 1]);
  // Carried to a new package, the makeup keeps its currency even if the next session is in dollars.
  const { next } = closePackage(p, two.makeup, true, 'py', 5, two.currency);
  assert.equal(next!.currency, '€');
  const after = packageStates([mk({ currency: '$', buyIn: 200, cashOut: 0, stakes: [{ ...x, packageId: 'py' }] })], [next!], { table }).states.get('py')!;
  assert.deepEqual([after.currency, after.makeup], ['€', 300]);
});

test('a new package starts from the backer\'s last deal and the current trip', () => {
  const list = [pkg({ id: 'a', createdAt: 1, kind: 'action', share: 10, markup: 1.2 }), pkg({ id: 'b', createdAt: 2, kind: 'makeup', share: 50, playerCut: 40 }), pkg({ id: 'c', backerId: 'b2', createdAt: 3, share: 5 })];
  assert.deepEqual(packageDefaults('b1', list, 'Estoril'), { kind: 'makeup', share: 50, markup: 1, playerCut: 40, name: 'Estoril' });
  assert.deepEqual(packageDefaults('b9', list), { kind: 'action', share: 20, markup: 1.1, playerCut: 50, name: '' });
});

test('last stake terms skip package pieces and other backers', () => {
  const list = [
    mk({ startedAt: 1, stakes: [{ backerId: 'b1', share: 15, markup: 1.15 }] }),
    mk({ startedAt: 2, stakes: [{ backerId: 'b1', share: 30, markup: 1, unpaid: true }, { backerId: 'b2', share: 5, markup: 1.3 }] }),
    mk({ startedAt: 3, stakes: [{ backerId: 'b1', packageId: 'p1', share: 50, markup: 1 }] }),
  ];
  assert.deepEqual(lastStakeTerms('b1', list), { share: 30, markup: 1, unpaid: true });
  assert.equal(lastStakeTerms('b3', list), null);
});

test('the player owes the backers exactly what their rows add up to', () => {
  const s = { cashOut: 222.22, stakes: [{ backerId: 'a', share: 15 }, { backerId: 'b', share: 15 }] } as unknown as Session;
  // 15% of 222,22 is 33,333 each: 33,33 + 33,33, never 66,67.
  assert.equal(owedToBackers(s), 66.66);
});

test('end-of-session sheet with a makeup package shows what the store will save', () => {
  // Backer pays 100% of buy-ins, I keep 50% of profit: MK1 500 → 0, then MK2 500 → 2000.
  const stake = { backerId: 'b1', packageId: 'p1', share: 100, markup: 1 };
  const mk1 = mk({ buyIn: 500, cashOut: 0, stakes: [stake] });
  const mk2 = mk({ buyIn: 500, cashOut: 0, endedAt: undefined, stakes: [stake] });
  const sessions = withCuts([mk1, mk2], [pkg()]);
  const pre = endPreview({ ...sessions[1], cashOut: 2000 }, sessions, [pkg()]);
  assert.deepEqual(pre, { owed: 1500, profit: 500 });
  // The same numbers once saved and recomputed.
  const saved = withCuts([mk1, { ...mk2, cashOut: 2000, endedAt: mk2.startedAt + 500 }], [pkg()])[1];
  assert.equal(profit(saved), 500);
  // A loss after a cut was taken gives part of it back (a negative cut): the backer gets it.
  const s1 = mk({ buyIn: 500, cashOut: 2000, stakes: [stake] });
  const s2 = mk({ buyIn: 500, cashOut: 0, endedAt: undefined, stakes: [stake] });
  const after = withCuts([s1, s2], [pkg()]);
  assert.deepEqual(endPreview({ ...after[1], cashOut: 0 }, after, [pkg()]), { owed: 250, profit: -250 });
  assert.deepEqual(endPreview({ ...after[1], cashOut: 1000 }, after, [pkg()]), { owed: 750, profit: 250 });
  // Without a package nothing changes: the whole prize share goes to the backer.
  assert.deepEqual(endPreview(mk({ buyIn: 500, cashOut: 2000, stakes: [{ share: 50, markup: 1 }] }), [], []), { owed: 1000, profit: 750 });
});

test('deleting a package or its backer keeps the makeup cut on past results', () => {
  // Makeup 50% of the action, 50% cut: 1000 buy-in, 5000 prize. Backer +2000, my cut 1000, profit 3000.
  const p = pkg({ share: 50 });
  const s = mk({ buyIn: 1000, cashOut: 5000, stakes: [{ backerId: 'b1', packageId: 'p1', share: 50, markup: 1 }] });
  const before = withCuts([s], [p])[0];
  assert.equal(profit(before), 3000);
  // «Apagar pacote»: the piece stays with the backer as a plain sale, with the cut it gave.
  const stakes = keepCuts([s], [p], new Set(['p1'])).get(s.id)!;
  assert.deepEqual(stakes, [{ backerId: 'b1', share: 50, markup: 1, cut: 1000 }]);
  const after = withCuts([{ ...s, stakes }], [])[0];
  assert.equal(after.makeupCut, 1000);
  assert.equal(profit(after), 3000);
  // The backer still gets back what they got before: prize share less the cut.
  const l = backerLedger('b1', [after], [], []);
  assert.equal(l.cut, 1000);
  assert.equal(l.owed, 1500);
  // «Apagar backer»: an unnamed piece, same cut (the store drops the name the same way).
  const anon = withCuts([{ ...s, stakes: [{ share: 50, markup: 1, cut: 1000 }] }], [])[0];
  assert.equal(profit(anon), 3000);
  // Kept through a restore and in the CSV's makeup_cut column.
  assert.deepEqual(fixSession(JSON.parse(JSON.stringify({ ...s, stakes })))?.stakes, stakes);
  const csv = sessionsCsv([after]).split('\n');
  const col = csv[0].split(',').indexOf('makeup_cut');
  assert.equal(csv[1].split(',')[col], '1000');
  // A cut that isn't a number doesn't reach the result.
  assert.equal(fixSession({ ...s, stakes: [{ share: 50, markup: 1, cut: 'x' }] })?.stakes?.[0].cut, undefined);
  // Another package on the same session keeps working it out, on top of the kept cut.
  const q = pkg({ id: 'p2', backerId: 'b2', share: 10 });
  const two = mk({ buyIn: 1000, cashOut: 5000, stakes: [{ backerId: 'b1', packageId: 'p1', share: 50, markup: 1 }, { backerId: 'b2', packageId: 'p2', share: 10, markup: 1 }] });
  const both = withCuts([two], [p, q])[0].makeupCut;
  const left = withCuts([{ ...two, stakes: keepCuts([two], [p, q], new Set(['p1'])).get(two.id)! }], [q])[0];
  assert.equal(left.makeupCut, both);
  // Running sessions have no cut yet: nothing kept.
  const live = mk({ endedAt: undefined, stakes: [{ backerId: 'b1', packageId: 'p1', share: 50, markup: 1 }] });
  assert.deepEqual(keepCuts([live], [p], new Set(['p1'])).get(live.id), [{ backerId: 'b1', share: 50, markup: 1 }]);
});

test('deleting a package with makeup to win back, or with cut taken back, changes no result', () => {
  const stake = { backerId: 'b1', packageId: 'p1', share: 100, markup: 1 };
  const pays: BackerPayment[] = [{ id: 'y', backerId: 'b1', amount: 300, at: 1, note: '', createdAt: 1 }];
  // Carried in 1000 of makeup, then +3000: cut 1000. Then +2000 (cut 1000) and −1000 (cut −500 back).
  const cases = [
    { p: pkg({ makeupIn: 1000 }), list: [mk({ buyIn: 1000, cashOut: 4000, stakes: [stake] })] },
    { p: pkg(), list: [mk({ buyIn: 1000, cashOut: 3000, stakes: [stake] }), mk({ buyIn: 1000, cashOut: 0, stakes: [{ ...stake, unpaid: true }] })] },
  ];
  for (const { p, list } of cases) {
    const before = withCuts(list, [p]);
    const lb = backerLedger('b1', before, [p], pays);
    const kept = keepCuts(list, [p], new Set(['p1']));
    const gone = list.map((s) => ({ ...s, stakes: kept.get(s.id)! }));
    const after = withCuts(gone, []);
    assert.deepEqual(after.map(profit), before.map(profit));
    const la = backerLedger('b1', after, [], pays);
    assert.deepEqual([la.cut, la.owed, la.balance], [lb.cut, lb.owed, lb.balance]);
    // The backer deleted: unnamed pieces, the player's results the same.
    const anon = withCuts(gone.map((s) => ({ ...s, stakes: s.stakes!.map((x) => ({ share: x.share, markup: x.markup, ...(x.cut ? { cut: x.cut } : {}) })) })), []);
    assert.deepEqual(anon.map(profit), before.map(profit));
  }
  assert.deepEqual(withCuts(cases[1].list, [pkg()]).map((s) => s.makeupCut), [1000, -500]);
});

test('reopening a closed package finds the one its makeup was carried to', () => {
  // «Outubro» closed with 100 of makeup, carried to «Outubro (2)».
  const p = pkg({ name: 'Outubro', createdAt: 1 });
  const s = mk({ cashOut: 0, stakes: [{ backerId: 'b1', packageId: 'p1', share: 100, markup: 1 }] });
  const { closed, next } = closePackage(p, 100, true, 'p2', 5000);
  assert.equal(next!.name, 'Outubro (2)');
  const other = pkg({ id: 'p3', makeupIn: 200, createdAt: 9000 });
  const list = [closed, next!, other, pkg({ id: 'p4', backerId: 'b2', makeupIn: 100, createdAt: 5000 })];
  assert.equal(carriedTo(closed, list)?.id, 'p2');
  // Forgiven (no new package), or still open: nothing to undo.
  assert.equal(carriedTo(closePackage(p, 100, false, 'p9', 5000).closed, [p]), undefined);
  assert.equal(carriedTo(p, list), undefined);
  // Reopened and the «(2)» kept: the same 100 twice (the bug).
  const reopened = { ...closed, closedAt: undefined };
  assert.equal(backerLedger('b1', [s], [reopened, next!], []).makeup, 200);
  // With the empty «(2)» deleted, the old package shows its open makeup again, once,
  // and nothing was carried on from the «(2)» (no «(3)» pointing at it).
  const after = [reopened, other];
  assert.equal(packageStates([s], after).states.get('p1')!.makeup, 100);
  assert.equal(backerLedger('b1', [s], [reopened], []).makeup, 100);
  assert.equal(carriedTo(next!, list), undefined);
  // A «(2)» closed and carried on to a «(3)» points at it: the screen keeps the old one closed then.
  const third = closePackage(next!, 100, true, 'p5', 7000);
  assert.equal(carriedTo(third.closed, [closed, third.closed, third.next!])?.id, 'p5');
  // Once the «(2)» has sessions the screen keeps the old one closed: the makeup is won back there.
  const t = mk({ stakes: [{ backerId: 'b1', packageId: 'p2', share: 100, markup: 1 }] });
  assert.equal(packageStates([s, t], list).states.get('p2')!.sessions, 1);
});

test("a session's makeup cut is the sum of the backers' rounded lines", () => {
  // Three backers at 1%, each in a 50% cut package: 100 buy-in, 1001 prize. Each line 4,505 → rounded on its own.
  const pk3 = ['b1', 'b2', 'b3'].map((b, i) => pkg({ id: 'p' + i, backerId: b, share: 1 }));
  const s = mk({ buyIn: 100, cashOut: 1001, stakes: pk3.map((p) => ({ backerId: p.backerId, packageId: p.id, share: 1, markup: 1 })) });
  const [cut] = withCuts([s], pk3);
  const pk = packageStates([s], pk3);
  const lines = pk3.map((p) => backerLedger(p.backerId, [s], pk3, [], pk).cut);
  const sum = Math.round(lines.reduce((a, x) => a + x, 0) * 100) / 100;
  assert.equal(cut.makeupCut, sum);
  assert.equal(Math.round(pk3.reduce((a, p) => a + pk.states.get(p.id)!.cut, 0) * 100) / 100, sum);
  // The end-of-session sheet says the same: backers get their rows, the player the rest.
  const pre = endPreview({ ...s, endedAt: undefined }, [{ ...s, endedAt: undefined }], pk3, s.endedAt);
  assert.equal(pre.profit, profit(cut));
  assert.equal(pre.owed, Math.round(pk3.reduce((a, p) => a + backerLedger(p.backerId, [s], pk3, [], pk).owed, 0) * 100) / 100);

  // Three backers with a third each, makeup to win back first: what is left is the makeup less their rows.
  const thirds = ['b1', 'b2', 'b3'].map((b, i) => pkg({ id: 'q' + i, backerId: b, share: 100 / 3, makeupIn: 10 }));
  const loss = mk({ buyIn: 100, cashOut: 33.34, stakes: thirds.map((p) => ({ backerId: p.backerId, packageId: p.id, share: 100 / 3, markup: 1 })) });
  const win = mk({ buyIn: 100, cashOut: 1000.01, stakes: thirds.map((p) => ({ backerId: p.backerId, packageId: p.id, share: 100 / 3, markup: 1 })) });
  const r1 = packageStates([loss], thirds);
  for (const p of thirds) {
    const row = backerLedger(p.backerId, [loss], thirds, [], r1).rows[0];
    assert.equal(r1.states.get(p.id)!.makeup, Math.round((10 - (row.owed - row.cost)) * 100) / 100);
  }
  const both = withCuts([loss, win], thirds);
  const r2 = packageStates([loss, win], thirds);
  const rows = thirds.map((p) => backerLedger(p.backerId, [loss, win], thirds, [], r2).rows.find((x) => x.session.id === win.id)!.cut);
  assert.equal(both[1].makeupCut, Math.round(rows.reduce((a, x) => a + x, 0) * 100) / 100);
});

test('festival action without a rate counts 1:1 and says which currency is missing (Bankroll P2)', () => {
  const l = backerLedger('b1', [], [], []);
  l.currency = '€';
  l.rows.push({} as never); // the deal already has a currency
  addOfferDue(l, 'Kč', 1000, 0, () => null);
  assert.equal(l.unpaid, 1000);
  assert.equal(l.balance, -1000);
  assert.deepEqual(l.missing, ['Kč']);
  addOfferDue(l, 'Kč', 0, 200, () => null);
  assert.deepEqual(l.missing, ['Kč'], 'once');
  assert.equal(l.balance, -800);
  // With a rate: converted, nothing missing.
  const m = backerLedger('b1', [], [], []);
  m.currency = '€';
  m.rows.push({} as never);
  addOfferDue(m, '$', 100, 0, () => 0.9);
  assert.equal(m.unpaid, 90);
  assert.deepEqual(m.missing, []);
  // A backer with no sessions yet takes the festival's currency.
  const n = backerLedger('b1', [], [], []);
  addOfferDue(n, '$', 100, 0, (a, b) => (a === b ? 1 : null));
  assert.equal(n.currency, '$');
  assert.deepEqual(n.missing, []);
});
