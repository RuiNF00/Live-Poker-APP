/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assignGroups, groupLedger, groupNet, groupsForSession, mergeGroups, minTransfers, newFromOthers, type GroupEntry, type SwapGroup } from '../swap-groups';
import { withSwaps } from '../swaps';
import type { Session } from '../types';

const D = 86400000;
const t0 = 100 * D;
let n = 0;
const e = (seat: number, kind: 'result' | 'payment', amount: number, over: Partial<GroupEntry> = {}): GroupEntry => ({ id: `e${++n}`, cid: `c${n}`, seat, kind, amount, event: '', finish: null, at: t0 + n, ...over });
const names = ['Rui', 'Ana', 'João', 'Marta'];
const group = (over: Partial<SwapGroup> = {}): SwapGroup => ({
  id: 'g1', token: 't', seat: 0,
  terms: { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: t0 },
  seats: names.map((name, seat) => ({ seat, name, confirmedAt: t0 })),
  entries: [], createdAt: t0, updatedAt: t0, ...over,
});
const sess = (over: Partial<Session>): Session => ({
  id: 'x', kind: 'mtt', name: '', venue: '', currency: '$', startedAt: t0 + D, endedAt: t0 + D + 3600000, breaks: [], buyIn: 1000, entries: 1, addOn: 0,
  cashOut: 0, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
});

test('each prize pays x% to every other player; the group always sums to zero', () => {
  // Ana cashes 100k at 2% in a group of 4: 2,000 to each of the 3 others.
  const g = group({ entries: [e(1, 'result', 100000), e(2, 'result', 10000)] });
  const net = groupNet(g);
  assert.equal(net.get(1), -6000 + 200);
  assert.equal(net.get(2), 2000 - 600);
  assert.equal(net.get(0), 2000 + 200);
  assert.equal([...net.values()].reduce((a, b) => a + b, 0), 0);
  const l = groupLedger(g);
  assert.equal(l.balance, 2200);
  assert.equal(l.effect, 2200);
});

test('the fewest transfers settle everyone, and payments count', () => {
  const g = group({ entries: [e(1, 'result', 100000)] });
  const tr = minTransfers(groupNet(g));
  assert.deepEqual(tr, [
    { from: 1, to: 0, amount: 2000 },
    { from: 1, to: 2, amount: 2000 },
    { from: 1, to: 3, amount: 2000 },
  ]);
  const paid = group({ entries: [e(1, 'result', 100000), e(1, 'payment', 2000, { to: 0 })] });
  assert.equal(minTransfers(groupNet(paid)).length, 2);
  assert.equal(groupLedger(paid).balance, 0);
  // Two winners: never more transfers than players minus one, and they settle every net.
  const two = group({ entries: [e(1, 'result', 100000), e(3, 'result', 30000), e(2, 'result', 5000)] });
  const net = groupNet(two);
  const t2 = minTransfers(net);
  assert.ok(t2.length <= 3);
  const after = new Map(net);
  for (const x of t2) {
    after.set(x.from, after.get(x.from)! + x.amount);
    after.set(x.to, after.get(x.to)! - x.amount);
  }
  for (const v of after.values()) assert.ok(Math.abs(v) < 0.5);
});

test('group swaps land in my results like pair swaps, and only once everyone is in', () => {
  const mine = sess({ id: 'm', name: 'Ev 1', cashOut: 50000 });
  const later = sess({ id: 'l', name: 'Ev 2', startedAt: t0 + 2 * D, endedAt: t0 + 2 * D + 1000 });
  const g = group({ entries: [e(0, 'result', 50000, { cid: 'k' }), e(1, 'result', 100000, { at: t0 + 3 * D })], links: { k: 'm' } });
  const a = assignGroups([mine, later], [g]).bySession;
  assert.equal(a.get('m'), -3000);
  assert.equal(a.get('l'), 2000);
  const out = withSwaps([mine, later], [], [g]);
  assert.equal(out[0].swapNet, -3000);
  assert.equal(out[1].swapNet, 2000);
  const waiting = group({ seats: names.map((name, seat) => ({ seat, name, confirmedAt: seat === 3 ? undefined : t0 })), entries: g.entries });
  assert.equal(assignGroups([mine, later], [waiting]).bySession.size, 0);
});

test('a finished tournament asks once per group it belongs to', () => {
  const s = sess({ id: 'm', name: 'Main', endedAt: t0 + D + 5 });
  assert.equal(groupsForSession([group()], s).length, 1);
  assert.equal(groupsForSession([group({ terms: { ...group().terms, currency: '€' } })], s).length, 0);
  assert.equal(groupsForSession([group({ entries: [e(0, 'result', 0, { cid: 'z' })], links: { z: 'm' } })], s).length, 0);
});

test('news, backup merge', () => {
  const before = group({ entries: [e(1, 'result', 5)] });
  const after = { ...before, entries: [...before.entries, e(2, 'result', 9, { id: 'new' }), e(0, 'payment', 1, { to: 1 })] };
  assert.deepEqual(newFromOthers(before, after).map((x) => x.id), ['new']);
  const pending = e(0, 'result', 7, { pending: true, cid: 'p' });
  const r = mergeGroups([group({ entries: [pending] })], [group({ updatedAt: t0 + 9 }), group({ id: 'g2' })]);
  assert.equal(r.added, 1);
  assert.ok(r.list.find((x) => x.id === 'g1')!.entries.some((x) => x.cid === 'p'));
});

test('one event: after my result, the seats still to record theirs', async () => {
  const { groupWaitingOn } = await import('../swap-groups');
  const ev = { ...group().terms, scope: 'event' as const };
  assert.deepEqual(groupWaitingOn(group({ terms: ev })), []);
  assert.deepEqual(groupWaitingOn(group({ terms: ev, entries: [e(0, 'result', 0), e(2, 'result', 900)] })), [1, 3]);
  assert.deepEqual(groupWaitingOn(group({ entries: [e(0, 'result', 0)] })), [], 'a series never waits');
});

test('a seat dropped before anyone took it leaves a gap in the numbers, and the accounts still add up', () => {
  // João (seat 2) never joined and was dropped: seats 0, 1 and 3 remain.
  const g = group({ seats: group().seats.filter((s) => s.seat !== 2), entries: [e(3, 'result', 100000), e(1, 'payment', 500, { to: 3 })] });
  const net = groupNet(g);
  assert.deepEqual([...net.keys()], [0, 1, 3]);
  assert.equal(net.get(0), 2000);
  assert.equal(net.get(1), 2000 + 500);
  assert.equal(net.get(3), -4000 - 500);
  assert.equal([...net.values()].reduce((a, b) => a + b, 0), 0);
  const tr = minTransfers(net);
  assert.ok(tr.every((x) => x.from === 3 && (x.to === 0 || x.to === 1)));
  assert.equal(tr.reduce((a, x) => a + x.amount, 0), 4500);
});
