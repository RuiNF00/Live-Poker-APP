/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup, parseBackup } from '../backup';
import { DEFAULT_SETTINGS } from '../types';
import { profit } from '../session-math';
import type { Session } from '../types';
import { assignSwaps, newFromOther, swapsToSettle, swapsForSession, mergeRemote, mergeSwaps, swapDeleteJobs, withSwaps, settled, settleGroups, settleNet, settleSteps, swapLedger, swapsTotal, type RemoteSwap, type Swap, type SwapEntry, type SwapTerms } from '../swaps';

const terms: SwapTerms = {
  v: 1, scope: 'series', title: 'WSOP Paradise', venue: 'Atlantis', currency: '$',
  a: { name: 'Rui', pct: 5 }, b: { name: 'João', pct: 3 }, note: '', createdAt: 1,
};
let n = 0;
const e = (side: 'a' | 'b', kind: SwapEntry['kind'], amount: number, over: Partial<SwapEntry> = {}): SwapEntry => ({ id: `e${++n}`, cid: `c${n}`, side, kind, amount, event: '', finish: null, at: n, ...over });
const swap = (over: Partial<Swap> = {}): Swap => ({ id: 's1', token: 'tok', side: 'a', terms, entries: [], confirmedAt: 10, createdAt: 1, updatedAt: 1, ...over });

test('each side owes its own % of its own prizes, netted', () => {
  // Rui (a, 5%) cashes 20k: owes 1,000. João (b, 3%) cashes 100k: owes 3,000.
  const l = swapLedger(swap({ entries: [e('a', 'result', 20000), e('b', 'result', 100000)] }));
  assert.equal(l.iOwe, 1000);
  assert.equal(l.theyOwe, 3000);
  assert.equal(l.balance, 2000);
  assert.equal(l.effect, 2000);
});

test('from the other side the same swap is the mirror image', () => {
  const entries = [e('a', 'result', 20000), e('b', 'result', 100000)];
  assert.equal(swapLedger(swap({ side: 'b', entries })).balance, -2000);
});

test('payments settle the balance', () => {
  const l = swapLedger(swap({ entries: [e('b', 'result', 100000), e('b', 'payment', 3000)] }));
  assert.equal(l.balance, 0);
  const mine = swapLedger(swap({ entries: [e('a', 'result', 10000), e('a', 'payment', 200)] }));
  assert.equal(mine.balance, -300);
});

test('a bust (prize 0) changes nothing', () => {
  assert.equal(swapLedger(swap({ entries: [e('a', 'result', 0)] })).balance, 0);
});

test('totals keep currencies apart and count unconfirmed swaps separately', () => {
  const t = swapsTotal([
    swap({ id: '1', entries: [e('b', 'result', 100000)] }),
    swap({ id: '2', terms: { ...terms, currency: '€' }, entries: [e('a', 'result', 10000)] }),
    swap({ id: '3', confirmedAt: undefined }),
    swap({ id: '4', archived: true, entries: [e('b', 'result', 1e6)] }),
    swap({ id: '5', gone: true, entries: [e('b', 'result', 1e6)] }),
  ]);
  assert.deepEqual(t.byCurrency.get('$'), { owedToMe: 3000, iOwe: 0, net: 3000 });
  assert.deepEqual(t.byCurrency.get('€'), { owedToMe: 0, iOwe: 500, net: -500 });
  assert.equal(t.open, 2);
  assert.equal(t.pending, 1);
});

test('merging the server copy keeps entries not sent yet, and drops them once they arrive', () => {
  const pending = e('a', 'result', 5000, { pending: true, cid: 'p1', id: 'p1' });
  const local = swap({ entries: [pending] });
  const remote: RemoteSwap = { id: 's1', terms, confirmedAt: '2026-10-17T10:00:00Z', confirmedName: 'João Silva', entries: [e('b', 'result', 100)], code: 'AB12-CD34', you: 'a', updatedAt: '' };
  const m = mergeRemote(local, remote, 99);
  assert.equal(m.entries.length, 2);
  assert.equal(m.confirmedName, 'João Silva');
  assert.equal(m.confirmedAt, Date.parse('2026-10-17T10:00:00Z'));
  const arrived = mergeRemote(m, { ...remote, entries: [...remote.entries, { ...pending, pending: undefined, id: 'srv' }] });
  assert.equal(arrived.entries.length, 2);
  assert.ok(arrived.entries.every((x) => !x.pending));
});

test('the accounts follow the creator’s Pro from the server, and a reply without it keeps the last answer', () => {
  const remote: RemoteSwap = { id: 's1', terms, confirmedAt: '2026-10-17T10:00:00Z', confirmedName: 'João', entries: [], code: null, you: 'b', updatedAt: '' };
  const open = mergeRemote(swap(), { ...remote, accounts: true });
  assert.equal(open.accounts, true);
  assert.equal(mergeRemote(open, remote).accounts, true);
  assert.equal(mergeRemote(open, { ...remote, accounts: false }).accounts, false);
});

test('erasing queues a delete for every swap still on the server, with its own token', () => {
  const jobs = swapDeleteJobs([swap({ id: 'mine', token: 'ta' }), swap({ id: 'theirs', side: 'b', token: 'tb', confirmedAt: undefined }), swap({ id: 'old', token: 'tc', gone: true })]);
  assert.deepEqual(jobs, [
    { id: 'mine', token: 'ta' },
    { id: 'theirs', token: 'tb' },
  ]);
});

test('swaps survive a backup round trip, and a restore keeps entries not sent yet', () => {
  const tok = 'ab12'.repeat(16);
  const s = swap({ id: 'Ab3dE6gH9k', token: tok, entries: [e('b', 'result', 100)] });
  // Ids and tokens go into URLs and headers: anything not shaped like the server's is dropped.
  const bad = [{ id: 'broken' }, { ...s, id: '../../x' }, { ...s, token: 'tok' }, { ...s, token: tok + '\n' }] as unknown as Swap[];
  const back = parseBackup(JSON.stringify(buildBackup({ hands: [], sessions: [], players: [], swaps: [s, ...bad], settings: DEFAULT_SETTINGS })));
  assert.equal(back.swaps?.length, 1);
  assert.equal(back.swaps?.[0].token, tok);

  const pending = e('a', 'result', 5, { pending: true, cid: 'p9' });
  const local = [swap({ updatedAt: 1, entries: [pending] })];
  const fresh = mergeSwaps(local, [swap({ updatedAt: 5, entries: [e('b', 'result', 100)] }), swap({ id: 'new' })]);
  assert.equal(fresh.added, 1);
  const merged = fresh.list.find((x) => x.id === 's1')!;
  assert.equal(merged.entries.length, 2);
  assert.ok(merged.entries.some((x) => x.cid === 'p9'));
  assert.equal(mergeSwaps(local, [swap({ updatedAt: 0 })]).list, local);
});

const sess = (over: Partial<Session>): Session => ({
  id: 'x', kind: 'mtt', name: '', venue: '', currency: '$', startedAt: 100 * DAYMS, endedAt: 100 * DAYMS + 3600000, breaks: [], buyIn: 1000, entries: 1, addOn: 0,
  cashOut: 0, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
});
const DAYMS = 86400000;

test('swaps land in my results: my prize loses my %, theirs adds my share to my latest session', () => {
  const t0 = 99 * DAYMS;
  const sw = swap({ terms: { ...terms, createdAt: t0 }, entries: [e('a', 'result', 20000, { event: 'Main', at: 101 * DAYMS }), e('b', 'result', 100000, { at: 102 * DAYMS })] });
  const main = sess({ id: 'main', name: 'Main', cashOut: 20000 });
  const later = sess({ id: 'later', startedAt: 101.5 * DAYMS, endedAt: 101.6 * DAYMS });
  const other$ = sess({ id: 'eur', currency: '€', startedAt: 101.7 * DAYMS, endedAt: 101.8 * DAYMS });
  const out = withSwaps([main, later, other$], [sw]);
  assert.equal(out.find((s) => s.id === 'main')!.swapNet, -1000); // 5% of my 20k
  assert.equal(out.find((s) => s.id === 'later')!.swapNet, 3000); // 3% of their 100k
  assert.equal(out.find((s) => s.id === 'eur')!.swapNet, undefined);
  assert.equal(profit(out.find((s) => s.id === 'main')!), 20000 - 1000 - 1000);
});

test('a saved link wins over matching, unconfirmed swaps count for nothing, and leftovers are reported', () => {
  const a = sess({ id: 'a', name: 'X', cashOut: 500 });
  const b = sess({ id: 'b', name: 'Y', cashOut: 500, startedAt: 100.5 * DAYMS, endedAt: 100.6 * DAYMS });
  const sw = swap({ links: { mine: 'a' }, terms: { ...terms, createdAt: 99 * DAYMS }, entries: [e('a', 'result', 500, { cid: 'mine', event: 'Y' })] });
  assert.equal(assignSwaps([a, b], [sw]).bySession.get('a'), -25);
  assert.equal(assignSwaps([a, b], [{ ...sw, confirmedAt: undefined }]).bySession.size, 0);
  const lone = assignSwaps([], [swap({ entries: [e('b', 'result', 100)] })]);
  assert.equal(lone.unassigned.length, 1);
  const list = [a];
  assert.equal(withSwaps(list, []), list);
});

test('a finished tournament asks for my result only in the swaps it belongs to, once', () => {
  const D = 86400000;
  const t0 = 100 * D;
  const series = swap({ id: 'ser', terms: { ...terms, createdAt: t0 } });
  const event = swap({ id: 'ev', terms: { ...terms, scope: 'event', title: '$10k Main Event', createdAt: t0 } });
  const euros = swap({ id: 'eur', terms: { ...terms, currency: '€', createdAt: t0 } });
  const pending = swap({ id: 'pen', confirmedAt: undefined, terms: { ...terms, createdAt: t0 } });
  const all = [series, event, euros, pending];
  const main = sess({ id: 'm', kind: 'mtt', name: '$10k main event', currency: '$', startedAt: t0 + D, endedAt: t0 + 2 * D, cashOut: 50000 });
  assert.deepEqual(swapsForSession(all, main).map((s) => s.id), ['ser', 'ev']);
  const side = sess({ id: 'x', kind: 'mtt', name: '$1k Turbo', currency: '$', startedAt: t0 + D, endedAt: t0 + D + 5000 });
  assert.deepEqual(swapsForSession(all, side).map((s) => s.id), ['ser']);
  // A session started from the festival plan is named per flight; the event swap still asks.
  assert.deepEqual(swapsForSession(all, { ...main, name: '$10k Main Event · Flight 1B' }).map((s) => s.id), ['ser', 'ev']);
  // Played before the swap began, cash games and live sessions never ask.
  assert.deepEqual(swapsForSession(all, { ...main, startedAt: t0 - 3 * D }).map((s) => s.id), []);
  assert.deepEqual(swapsForSession(all, { ...main, kind: 'cash' }), []);
  assert.deepEqual(swapsForSession(all, { ...main, endedAt: undefined }), []);
  // Once my result from that session is in, it stops asking.
  const done = { ...series, entries: [e('a', 'result', 0, { cid: 'k1' })], links: { k1: 'm' } };
  assert.deepEqual(swapsForSession([done], main), []);
  // Their entries don't count as mine.
  assert.equal(swapsForSession([{ ...series, entries: [e('b', 'result', 50000, { event: '$10k main event' })] }], main).length, 1);
});

test("only the other player's new entries are news", () => {
  const before = swap({ entries: [e('b', 'result', 100, { id: 'old' })] });
  const after = { ...before, entries: [...before.entries, e('b', 'result', 5000, { id: 'new' }), e('a', 'payment', 50, { id: 'mine' })] };
  assert.deepEqual(newFromOther(before, after).map((x) => x.id), ['new']);
  assert.deepEqual(newFromOther(undefined, after), []);
});

test('unsettled swaps: confirmed, money still owed, not left, archived or gone', async () => {
  const { unsettledSwaps } = await import('../swaps');
  const owing = swap({ entries: [e('b', 'result', 10000)] });
  assert.equal(unsettledSwaps([owing, swap({}), swap({ entries: [e('b', 'result', 10000)], archived: true }), swap({ entries: [e('b', 'result', 10000)], left: 'b' })], []), 1);
});

test('the other side leaving is kept from the server copy', () => {
  const remote: RemoteSwap = { id: 's1', terms: { ...terms, b: { name: '-', pct: 3 } }, confirmedAt: new Date(10).toISOString(), confirmedName: '-', entries: [], code: null, you: 'a', updatedAt: new Date(20).toISOString(), leftSide: 'b' };
  const m = mergeRemote(swap({ confirmedName: 'João' }), remote);
  assert.equal(m.left, 'b');
  assert.equal(m.terms.b.name, 'João', 'this phone keeps the name it already had');
  assert.equal(m.confirmedName, 'João');
  assert.equal(mergeRemote(swap({ terms: { ...terms, b: { name: '-', pct: 3 } } }), remote).terms.b.name, '-');
});

test('one event waits on the other side once my result is in', async () => {
  const { waitingOn } = await import('../swaps');
  const ev = { ...terms, scope: 'event' as const };
  assert.equal(waitingOn(swap({ terms: ev })), null, 'nothing in yet');
  assert.equal(waitingOn(swap({ terms: ev, entries: [e('a', 'result', 0)] })), 'b');
  assert.equal(waitingOn(swap({ terms: ev, entries: [e('a', 'result', 0), e('b', 'result', 5000)] })), null);
  assert.equal(waitingOn(swap({ entries: [e('a', 'result', 0)] })), null, 'a series never waits');
  assert.equal(waitingOn(swap({ terms: ev, entries: [e('a', 'result', 0)], left: 'b' })), null);
});

test('a one-event swap is "falta acertar" once both results are in and money is owed', () => {
  const ev = { ...terms, scope: 'event' as const, title: 'Main Event', venue: 'Lisboa' };
  // Only my result: still waiting, nothing to settle yet.
  assert.deepEqual(swapsToSettle([swap({ terms: ev, entries: [e('a', 'result', 0)] })], []), []);
  const both = swap({ terms: ev, entries: [e('a', 'result', 0), e('b', 'result', 100000, { at: 500 })] });
  assert.deepEqual(swapsToSettle([both], []), [{ id: 's1', group: false, place: 'Lisboa', name: 'João', pay: false, closedAt: 500 }]);
  // From the other phone the same swap is mine to pay.
  assert.equal(swapsToSettle([{ ...both, side: 'b' }], [])[0].pay, true);
  // Paid, busted both, archived, or a whole series: nothing.
  assert.deepEqual(swapsToSettle([swap({ terms: ev, entries: [...both.entries, e('b', 'payment', 3000)] })], []), []);
  assert.deepEqual(swapsToSettle([swap({ terms: ev, entries: [e('a', 'result', 0), e('b', 'result', 0)] })], []), []);
  assert.deepEqual(swapsToSettle([{ ...both, archived: true }], []), []);
  assert.deepEqual(swapsToSettle([{ ...both, terms }], []), []);
});

test('a group is "falta acertar" for me only when a transfer involves me', () => {
  const seats = [0, 1, 2].map((seat) => ({ seat, name: ['Rui', 'Ana', 'Zé'][seat], confirmedAt: 1 }));
  const r = (seat: number, amount: number, at = 1) => ({ id: `g${seat}`, cid: `g${seat}`, seat, kind: 'result' as const, event: '', amount, finish: null, at });
  const g = {
    id: 'g1', token: 'tok', seat: 0, seats, createdAt: 1, updatedAt: 1,
    terms: { v: 1 as const, scope: 'event' as const, title: 'Main Event', venue: '', currency: '€', pct: 5, note: '', createdAt: 1 },
    entries: [r(0, 0), r(1, 10000, 900), r(2, 0)],
  };
  assert.deepEqual(swapsToSettle([], [g]), [{ id: 'g1', group: true, place: 'Main Event', name: 'Main Event', pay: false, closedAt: 900 }]);
  assert.equal(swapsToSettle([], [{ ...g, seat: 1 }])[0].pay, true);
  assert.deepEqual(swapsToSettle([], [{ ...g, entries: [r(0, 0), r(1, 10000)] }]), []);
});

test('a swap is settled only at 0,00: 0,40 and 0,01 are still owed', () => {
  const owes40 = swapLedger(swap({ entries: [e('a', 'result', 8)] }));
  assert.equal(Math.abs(owes40.balance), 0.4);
  assert.equal(settled(owes40), false);
  const owes1 = swapLedger(swap({ entries: [e('a', 'result', 0.2)] }));
  assert.equal(Math.abs(owes1.balance), 0.01);
  assert.equal(settled(owes1), false);
  assert.equal(settled(swapLedger(swap({ entries: [e('a', 'result', 8), e('a', 'payment', 0.4)] }))), true);
});

test('received: my note that they paid me lowers what they owe, never what I owe', () => {
  // João (b, 3%) cashes 100k: owes Rui 3,000. Rui marks 1,000 received.
  const l = swapLedger(swap({ entries: [e('b', 'result', 100000), e('a', 'received', 1000)] }));
  assert.equal(l.theyPaid, 1000);
  assert.equal(l.iPaid, 0);
  assert.equal(l.balance, 2000);
  // João sees the same from his side.
  assert.equal(swapLedger(swap({ side: 'b', entries: [e('b', 'result', 100000), e('a', 'received', 1000)] })).balance, -2000);
});

test('settling several swaps with one player: one net, every swap at 0,00', () => {
  const t2 = { ...terms, a: { name: 'Rui', pct: 10 }, b: { name: 'João', pct: 10 } };
  // Swap 1: João owes me 300. Swap 2: I owe him 100.40. Swap 3: square. Swap 4: another player.
  const s1 = swap({ id: '1', terms: t2, entries: [e('b', 'result', 3000)] });
  const s2 = swap({ id: '2', terms: t2, entries: [e('a', 'result', 1004)] });
  const s3 = swap({ id: '3', terms: t2, entries: [] });
  const s4 = swap({ id: '4', terms: { ...t2, b: { name: 'Ana', pct: 10 } }, entries: [e('b', 'result', 500)] });
  // He confirmed with a slightly different spelling: still the same player.
  const s5 = swap({ id: '5', terms: { ...t2, currency: '€' }, confirmedName: 'joão ', entries: [e('b', 'result', 10)] });
  const groups = settleGroups([s1, s2, s3, s4, s5]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].swaps.map((s) => s.id), ['1', '2']);
  assert.equal(groups[0].net, 199.6);
  const steps = settleSteps(groups[0].swaps);
  assert.deepEqual(steps, [
    { id: '1', kind: 'received', amount: 300 },
    { id: '2', kind: 'payment', amount: 100.4 },
  ]);
  // Recording them closes both swaps.
  const done = groups[0].swaps.map((s) => ({ ...s, entries: [...s.entries, ...steps.filter((x) => x.id === s.id).map((x) => e('a', x.kind, x.amount))] }));
  assert.ok(done.every((s) => settled(swapLedger(s))));
  assert.equal(settleNet(done), 0);
});

test('settle-up leaves out swaps that are read-only, unconfirmed, archived or waiting to send', () => {
  const owed = [e('b', 'result', 1000)];
  const list = [
    swap({ id: '1', entries: owed }),
    swap({ id: '2', entries: owed, left: 'b' }),
    swap({ id: '3', entries: owed, archived: true }),
    swap({ id: '4', entries: owed, confirmedAt: undefined }),
    swap({ id: '5', entries: [...owed, e('a', 'payment', 1, { pending: true })] }),
    swap({ id: '6', entries: owed, gone: true }),
  ];
  assert.equal(settleGroups(list).length, 0);
});

test('a payment both players record («Paguei» and «Recebi») counts once, in any order', () => {
  const t75: SwapTerms = { ...terms, a: { name: 'Ana', pct: 7.5 }, b: { name: 'Eva', pct: 7.5 } };
  const win = e('a', 'result', 1234.5);
  const both = [win, e('a', 'payment', 92.59), e('b', 'received', 92.59)];
  for (const entries of [both, [both[0], both[2], both[1]]]) {
    const ana = swapLedger(swap({ terms: t75, side: 'a', entries }));
    const eva = swapLedger(swap({ terms: t75, side: 'b', entries }));
    assert.equal(ana.iPaid, 92.59);
    assert.equal(eva.theyPaid, 92.59);
    assert.equal(ana.balance, 0);
    assert.equal(eva.balance, 0);
  }
  // Two different payments still add up, and the same payment tapped twice by its payer is two.
  assert.equal(swapLedger(swap({ terms: t75, entries: [win, e('a', 'payment', 50), e('b', 'received', 42.59)] })).balance, 0);
  assert.equal(swapLedger(swap({ terms: t75, entries: [win, e('a', 'payment', 46.3), e('a', 'payment', 46.3), e('b', 'received', 46.3)] })).iPaid, 92.6);
});

test('both players settling up before either syncs still leaves every swap at 0,00', () => {
  const s1 = swap({ id: 's1', entries: [e('a', 'result', 1000), e('b', 'result', 300)] });
  const s2 = swap({ id: 's2', entries: [e('b', 'result', 2000)] });
  const mine = settleSteps([s1, s2]);
  const theirs = settleSteps([s1, s2].map((s) => ({ ...s, side: 'b' as const })));
  for (const s of [s1, s2]) {
    const add = [...mine.filter((x) => x.id === s.id).map((x) => e('a', x.kind, x.amount)), ...theirs.filter((x) => x.id === s.id).map((x) => e('b', x.kind, x.amount))];
    const entries = [...s.entries, ...add];
    assert.equal(swapLedger({ ...s, entries }).balance, 0);
    assert.equal(swapLedger({ ...s, side: 'b', entries }).balance, 0);
  }
});
