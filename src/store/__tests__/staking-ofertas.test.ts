/// <reference types="node" />
// Staking and festival offers end to end: two backers with markup, a re-entry, a settlement half-way
// through the festival and the backer's page. Each test fails without the fix it names.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildStatement } from '../../lib/backing-link';
import { BAHAMAS_DEC_2026 as F } from '../../poker/festival-data';
import { lineSettlement, newOffer, offerPackageIds, offerStakeChanges, paidInFull, pendingCost, stakesFor, withOfferStakes, type ActionOffer } from '../action-offer';
import { backerLedger, endPreview, packageStates, pieceSteps, settleUp, stakeDue, yearStatement } from '../staking';
import type { Session, StakePackage } from '../types';
import { fixSession } from '../validate';

// Event 2 ($26,000) and event 3 ($50,000), markup 1.2: Ana 10% paid ahead, Bruno 5% not paid yet.
const ana = { id: 'l1', backerId: 'ana', packageId: 'pa', pct: 10, paid: true };
const bruno = { id: 'l2', backerId: 'bruno', packageId: 'pb', pct: 5 };
const offer: ActionOffer = { ...newOffer(F, ['2', '3'], 'o1', 1), markup: 1.2, lines: [ana, bruno] };
const packages: StakePackage[] = [
  { id: 'pa', backerId: 'ana', name: 'Bahamas', kind: 'action', share: 10, markup: 1.2, playerCut: 0, createdAt: 0 },
  { id: 'pb', backerId: 'bruno', name: 'Bahamas', kind: 'action', share: 5, markup: 1.2, playerCut: 0, createdAt: 0 },
];
const event2 = (over: Partial<Session> = {}): Session =>
  ({
    id: 's2', kind: 'mtt', name: 'Event 2', venue: '', currency: '$', startedAt: Date.UTC(2026, 11, 3, 18), endedAt: Date.UTC(2026, 11, 4, 2), breaks: [],
    buyIn: 26000, entries: 2, addOn: 0, cashOut: 200000, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 8, stack: 0, stackLog: [], roster: [], notes: '',
    stakes: stakesFor([offer], F.id, '2'),
    ...over,
  }) as Session;

test('a festival piece paid ahead covers one entry: the re-entry is still due, as in an unpaid piece', () => {
  const s = event2();
  const [a, b] = s.stakes!;
  assert.equal(a.prepaid, true);
  assert.equal(b.unpaid, true);
  // Ana: 10% × 26,000 × 1.2 for the re-entry. Bruno: 5% of both entries × 1.2.
  assert.equal(stakeDue(s, a), 3120);
  assert.equal(stakeDue(s, b), 3120);
  const la = backerLedger('ana', [s], packages, []);
  const lb = backerLedger('bruno', [s], packages, []);
  // Ana gets 10% of 200,000 and pays the re-entry: before the fix, 20,000 with two entries for one paid.
  assert.equal(la.unpaid, 3120);
  assert.equal(la.balance, 20000 - 3120);
  assert.equal(lb.balance, 10000 - 3120);
  assert.equal(pieceSteps(la.rows[0]).balance, la.balance);
  // The package screen says the same as the backer's balance (event 3 not started: Ana's is paid, Bruno's pending).
  const sa = lineSettlement(F, offer, ana, { '2': 's2' }, [s]);
  const sb = lineSettlement(F, offer, bruno, { '2': 's2' }, [s]);
  assert.equal(sa.net, la.balance);
  assert.equal(sb.net, lb.balance - pendingCost(F, offer, bruno, { '2': 's2' }));
  assert.equal(sa.paid, false);
  // One entry only: nothing more to pay.
  assert.equal(stakeDue(event2({ entries: 1 }), a), 0);
});

test('settling half-way through the festival pays the re-entries, and they stay paid when the stakes are rebuilt', () => {
  const s = event2();
  const before = offerPackageIds([offer]);
  // «Marcar como pago» with Ana: her pieces paid in full, then the line's stakes rebuilt as the screen does.
  const paid = paidInFull([s], new Set(['pa']));
  assert.equal(paid.length, 1);
  const rebuilt = offerStakeChanges(paid, [offer], F.id, { '2': 's2' }, before);
  const after = rebuilt.find((x) => x.id === 's2') ?? paid[0];
  assert.equal(backerLedger('ana', [after], packages, []).unpaid, 0);
  // Bruno's piece is not touched by Ana's settlement.
  assert.equal(backerLedger('bruno', [after], packages, []).unpaid, 3120);
  // Without paidInFull the rebuilt stake would ask for the re-entry again.
  const again = offerStakeChanges([s], [offer], F.id, { '2': 's2' }, before);
  assert.equal(again.length, 0);
  assert.equal(backerLedger('ana', [s], packages, []).unpaid, 3120);
});

test('a re-entry after the settle-up is still the backer\'s to pay, and only that one', () => {
  const s = event2();
  const before = offerPackageIds([offer]);
  // Settled with two entries in: Ana owes nothing, and settling again changes nothing.
  const [paid] = paidInFull([s], new Set(['pa']));
  assert.equal(paid.stakes![0].paidCost, 52000);
  assert.equal(stakeDue(paid, paid.stakes![0]), 0);
  assert.equal(paidInFull([paid], new Set(['pa'])).length, 0);
  // The stakes rebuilt after the settle-up keep what was paid.
  const rebuilt = offerStakeChanges([paid], [offer], F.id, { '2': 's2' }, before)[0] ?? paid;
  assert.equal(rebuilt.stakes![0].paidCost, 52000);
  // A third entry after it: Ana's 10% × 26,000 × 1.2 is due again, not all three.
  const third = { ...rebuilt, entries: 3 };
  assert.equal(stakeDue(third, third.stakes![0]), 3120);
  assert.equal(backerLedger('ana', [third], packages, []).unpaid, 3120);
  // Rebuilding the stakes again doesn't wipe it out.
  const again = offerStakeChanges([third], [offer], F.id, { '2': 's2' }, before)[0] ?? third;
  assert.equal(backerLedger('ana', [again], packages, []).unpaid, 3120);
  // Settling again pays that one, and the paid cost moves up.
  const [settled] = paidInFull([again], new Set(['pa']));
  assert.equal(settled.stakes![0].paidCost, 78000);
  assert.equal(backerLedger('ana', [settled], packages, []).unpaid, 0);
  // Bruno's piece was never settled: all three entries are still his to pay.
  assert.equal(backerLedger('bruno', [settled], packages, []).unpaid, 0.05 * 78000 * 1.2);
});

test('a paidCost that is not a number is dropped from a backup', () => {
  const s = event2();
  const bad = fixSession({ ...s, stakes: [{ ...s.stakes![0], paidCost: 'x' as never }, s.stakes![1]] });
  assert.equal(bad!.stakes![0].paidCost, undefined);
});

test('a festival session from before re-entries were charged keeps its paid piece', () => {
  const old = event2({ stakes: [{ backerId: 'ana', packageId: 'pa', share: 10, markup: 1.2 }] });
  const next = withOfferStakes(old.stakes, stakesFor([offer], F.id, '2'), offerPackageIds([offer]));
  const a = next.find((x) => x.packageId === 'pa')!;
  assert.equal(a.prepaid, undefined);
  assert.equal(a.unpaid, undefined);
  // The line not paid any more: the whole piece is due again.
  const unpaid = withOfferStakes(old.stakes, stakesFor([{ ...offer, lines: [{ ...ana, paid: false }, bruno] }], F.id, '2'), offerPackageIds([offer]));
  assert.equal(unpaid.find((x) => x.packageId === 'pa')!.unpaid, true);
});

test('«Marcar como pago» on the whole balance counts what each piece still owes, re-entries included', () => {
  const s = event2({ stakes: [{ backerId: 'ana', share: 10, markup: 1.2, prepaid: true }] });
  const l = backerLedger('ana', [s], [], []);
  const { amount, paid } = settleUp(l, () => 1);
  // Owed 20,000, she still pays 3,120: the payment is the 20,000 the pieces add up to once paid.
  assert.equal(paid.length, 1);
  assert.equal(amount, 20000);
});

test('a backup with a prepaid that is not true loses it, as with bountiesKept', () => {
  const s = fixSession({ ...event2(), stakes: [{ backerId: 'ana', share: 10, markup: 1.2, prepaid: 'yes' as unknown as true }] });
  assert.equal(s!.stakes![0].prepaid, undefined);
});

test("the backer's page rounds half cents as the app does, and flags a re-entry still due", () => {
  // 50% of 157.45: 78.725, shown as 78.73 in the app; the link said 78.72.
  const s = event2({ id: 'x', currency: '€', buyIn: 157.45, entries: 1, cashOut: 0, stakes: [{ backerId: 'ana', share: 50, markup: 1 }] });
  const backer = { id: 'ana', name: 'Ana', note: '', shareKey: 'k_abc123', createdAt: 0 };
  const st = buildStatement(backer, 'Rui', '€', [s], [], []);
  assert.equal(st.rows[0].c, 78.73);
  assert.equal(st.rows[0].u, undefined);
  const re = buildStatement(backer, 'Rui', '$', [event2()], packages, []);
  assert.equal(re.rows[0].u, 1);
});

test('the year with a backer adds the sessions to the cent, like the ledger', () => {
  const two = [1, 2].map((i) => event2({ id: 'y' + i, currency: '€', buyIn: 157.45, entries: 1, cashOut: 0, stakes: [{ backerId: 'ana', share: 50, markup: 1 }], startedAt: Date.UTC(2026, 2, i, 12), endedAt: Date.UTC(2026, 2, i, 18) }));
  const l = backerLedger('ana', two, [], []);
  const y = yearStatement(l, 2026, [], packageStates(two, []));
  assert.equal(l.invested, 157.46);
  assert.equal(y.cost, l.invested);
  assert.equal(y.net, l.result);
});

test('the end-of-session sheet works out the makeup with the rates, as the store does once saved', () => {
  // Makeup in €, 50% cut: −1,000 $ (−500 € at 2 $/€) to win back before the cut, then +1,500 €.
  const p: StakePackage = { id: 'm', backerId: 'ana', name: 'Makeup', kind: 'makeup', share: 100, markup: 1, playerCut: 50, currency: '€', createdAt: 0 };
  const stake = { backerId: 'ana', packageId: 'm', share: 100, markup: 1 };
  const lost = event2({ id: 'm1', currency: '$', buyIn: 1000, entries: 1, cashOut: 0, stakes: [stake], startedAt: 1000, endedAt: 2000 });
  const now = event2({ id: 'm2', currency: '€', buyIn: 500, entries: 1, cashOut: 0, stakes: [stake], startedAt: 3000, endedAt: undefined });
  const fx = { table: {}, manual: { USD: 2 } };
  // 2,000 prize: the 500 € lost first, then 50% of 1,000: the backer gets 1,500. Without rates, 1,250.
  assert.deepEqual(endPreview({ ...now, cashOut: 2000 }, [lost, now], [p], 4000, fx), { owed: 1500, profit: 500 });
});

test('a festival session logged in another currency is settled in the festival currency', () => {
  // Event 2 logged in € at 0.5 €/$... the settlement is in $, so its € amounts are converted back.
  const s = event2({ currency: '€', buyIn: 13000, entries: 1, cashOut: 100000 });
  const st = lineSettlement(F, offer, ana, { '2': 's2' }, [s], undefined, () => 2);
  assert.equal(st.rows[0].prize, 20000);
  assert.equal(st.rows[0].cost, 3120);
});
