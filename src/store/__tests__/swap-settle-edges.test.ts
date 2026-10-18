/// <reference types="node" />
// Settling up, at the edges: the same money marked twice, currencies that never mix, and every
// share and transfer to the cent. Random cases with a fixed seed, so a failure repeats.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupNet, HALF_CENT, minTransfers, type GroupEntry, type SwapGroup } from '../swap-groups';
import { mergeRemote, seenTag, settled, settleGroups, settleNet, settleSteps, swapLedger, swapsTotal, type RemoteSwap, type Swap, type SwapEntry, type SwapTerms } from '../swaps';

let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const cents = (a: number, b: number) => int(a * 100, b * 100) / 100;
const isCent = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

const terms = (cur = '€', pa = 10, pb = 10, b = 'Bruno'): SwapTerms => ({ v: 1, scope: 'series', title: 'Série', venue: '', currency: cur, a: { name: 'Ana', pct: pa }, b: { name: b, pct: pb }, note: '', createdAt: 1 });
let n = 0;
const e = (side: 'a' | 'b', kind: SwapEntry['kind'], amount: number, over: Partial<SwapEntry> = {}): SwapEntry => ({ id: `e${++n}`, cid: `c${n}`, side, kind, amount, event: '', finish: null, at: n, ...over });
const swap = (over: Partial<Swap> = {}): Swap => ({ id: `s${++n}`, token: 't', side: 'a', terms: terms(), entries: [], confirmedAt: 1, createdAt: 1, updatedAt: 1, ...over });

test('a payment sent again (same cid after no signal or a restore) is on the phone once', () => {
  const pending = e('a', 'payment', 50, { cid: 'k1', pending: true });
  const local = swap({ entries: [e('b', 'result', 1000), pending] });
  const remote: RemoteSwap = { id: local.id, terms: local.terms, confirmedAt: '2026-10-18T10:00:00Z', confirmedName: null, code: null, you: 'a', updatedAt: '', entries: [local.entries[0], { ...pending, pending: undefined, id: 'srv' }] };
  const merged = mergeRemote(local, remote);
  assert.equal(merged.entries.filter((x) => x.cid === 'k1').length, 1);
  assert.equal(swapLedger(merged).balance, 150);
});

test('«Paguei» and «Recebi» for the same money count once; a second real payment still counts', () => {
  // B owes 600. B taps «Paguei 300» and A taps «Recebi 300» for the same transfer, neither phone
  // having seen the other's (both ~0): one payment, 300 still owed.
  const res = e('b', 'result', 6000);
  const p1 = e('b', 'payment', 300, { cid: 'x' + seenTag([res], 'b', 'payment', 300) });
  const r1 = e('a', 'received', 300, { cid: 'y' + seenTag([res], 'a', 'received', 300) });
  const both = swap({ entries: [res, p1, r1] });
  assert.equal(swapLedger(both).balance, 300);
  assert.equal(swapLedger({ ...both, side: 'b' }).balance, -300);
  // B pays the other 300, having already seen A's «Recebi 300» (~1): it counts, the swap is square.
  const p2 = e('b', 'payment', 300, { cid: 'z' + seenTag([res, p1, r1], 'b', 'payment', 300) });
  assert.match(p2.cid, /~1$/);
  assert.ok(settled(swapLedger(swap({ entries: [res, p1, r1, p2] }))));
  // Whatever order the server hands them back in.
  assert.ok(settled(swapLedger(swap({ entries: [p2, r1, res, p1] }))));
});

test('«Acertar contas» on both phones at once closes the swap once', () => {
  for (const owed of [987.4, 0.01, 1234.56]) {
    const res = e('b', 'result', owed * 10);
    const s = swap({ entries: [res] });
    const fromA = settleSteps([s]).map((x) => e('a', x.kind, x.amount, { cid: 'a' + seenTag(s.entries, 'a', x.kind, x.amount) }));
    const fromB = settleSteps([{ ...s, side: 'b' }]).map((x) => e('b', x.kind, x.amount, { cid: 'b' + seenTag(s.entries, 'b', x.kind, x.amount) }));
    const all = [res, ...fromA, ...fromB];
    assert.ok(settled(swapLedger(swap({ entries: all }))), `owed ${owed}`);
    assert.ok(settled(swapLedger(swap({ entries: all, side: 'b' }))));
  }
});

test('both sides mirror each other to the cent, and settling closes both at 0,00', () => {
  for (let i = 0; i < 2000; i++) {
    const t = terms('€', int(1, 200) / 10, int(1, 200) / 10);
    const entries: SwapEntry[] = [];
    for (let j = int(1, 8); j > 0; j--) entries.push(e(rnd() < 0.5 ? 'a' : 'b', 'result', cents(0, 20000)));
    for (let j = int(0, 3); j > 0; j--) entries.push(e(rnd() < 0.5 ? 'a' : 'b', rnd() < 0.5 ? 'payment' : 'received', cents(0.01, 300)));
    const a = swapLedger(swap({ terms: t, entries }));
    const b = swapLedger(swap({ terms: t, entries, side: 'b' }));
    assert.ok(Math.abs(a.balance + b.balance) < 1e-9, `case ${i}: ${a.balance} vs ${b.balance}`);
    assert.ok(isCent(a.balance), `balance ${a.balance} is not to the cent`);
    const s = swap({ terms: t, entries });
    const steps = settleSteps([s]);
    const closed = { ...s, entries: [...entries, ...steps.map((x) => e('a', x.kind, x.amount))] };
    assert.ok(settled(swapLedger(closed)), `case ${i} not settled`);
    assert.ok(Math.abs(swapLedger(closed).balance) < HALF_CENT);
  }
});

test('currencies never mix: settling up and the totals keep € and $ apart', () => {
  const list = [
    swap({ terms: terms('€'), entries: [e('b', 'result', 1000)] }),
    swap({ terms: terms('€'), entries: [e('a', 'result', 400)] }),
    swap({ terms: terms('$'), entries: [e('b', 'result', 5000)] }),
    swap({ terms: terms('$'), entries: [e('b', 'result', 10)] }),
    swap({ terms: terms('R$'), entries: [e('b', 'result', 999)] }),
  ];
  const groups = settleGroups(list);
  assert.deepEqual(groups.map((g) => [g.currency, g.swaps.length, g.net]).sort(), [['$', 2, 501], ['€', 2, 60]]);
  for (const g of groups) assert.ok(g.swaps.every((s) => s.terms.currency === g.currency));
  const tot = swapsTotal(list);
  assert.equal(tot.byCurrency.get('€')?.net, 60);
  assert.equal(tot.byCurrency.get('$')?.net, 501);
  assert.equal(tot.byCurrency.get('R$')?.net, 99.9);
  assert.equal(settleNet(groups[0].swaps) + settleNet(groups[1].swaps), 561); // only ever shown apart
});

test('groups: every share and transfer is to the cent, and paying the transfers squares everyone', () => {
  const names = ['Ana', 'Bruno', 'Carla', 'Duarte', 'Eva', 'Filipe', 'Gil', 'Helena'];
  for (let i = 0; i < 2000; i++) {
    const size = int(3, 8);
    const g: SwapGroup = {
      id: 'g', token: 't', seat: 0, createdAt: 1, updatedAt: 1,
      terms: { v: 1, scope: 'series', title: 'Série', venue: '', currency: '€', pct: int(1, 200) / 10, note: '', createdAt: 1 },
      seats: names.slice(0, size).map((name, seat) => ({ seat, name, confirmedAt: 1 })),
      entries: [],
    };
    const entries: GroupEntry[] = [];
    for (let j = int(1, 10); j > 0; j--) entries.push({ id: `g${j}`, cid: `g${j}`, seat: int(0, size - 1), kind: 'result', amount: cents(0, 50000), event: '', finish: null, at: j });
    const net = groupNet({ ...g, entries });
    const sum = [...net.values()].reduce((x, y) => x + y, 0);
    assert.ok(Math.abs(sum) < 1e-6, `group ${i} sums to ${sum}`);
    for (const v of net.values()) assert.ok(isCent(v), `net ${v} is not to the cent`);
    const tr = minTransfers(net);
    for (const x of tr) assert.ok(isCent(x.amount) && x.amount > 0);
    const paid = [...entries, ...tr.map((x, j): GroupEntry => ({ id: `p${j}`, cid: `p${j}`, seat: x.from, kind: 'payment', to: x.to, amount: x.amount, event: '', finish: null, at: 100 + j }))];
    for (const v of groupNet({ ...g, entries: paid }).values()) assert.ok(Math.abs(v) < 0.005, `group ${i} left ${v} after paying`);
    assert.ok(tr.length <= size - 1, 'at most one transfer fewer than players');
  }
});
