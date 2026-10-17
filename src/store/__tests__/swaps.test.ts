/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup, parseBackup } from '../backup';
import { DEFAULT_SETTINGS } from '../types';
import { mergeRemote, mergeSwaps, swapDeleteJobs, swapLedger, swapsTotal, type RemoteSwap, type Swap, type SwapEntry, type SwapTerms } from '../swaps';

const terms: SwapTerms = {
  v: 1, scope: 'series', title: 'WSOP Paradise', venue: 'Atlantis', currency: '$',
  a: { name: 'Rui', pct: 5 }, b: { name: 'João', pct: 3 }, note: '', createdAt: 1,
};
let n = 0;
const e = (side: 'a' | 'b', kind: 'result' | 'payment', amount: number, over: Partial<SwapEntry> = {}): SwapEntry => ({ id: `e${++n}`, cid: `c${n}`, side, kind, amount, event: '', finish: null, at: n, ...over });
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

test('erasing queues a delete for every swap still on the server, with its own token', () => {
  const jobs = swapDeleteJobs([swap({ id: 'mine', token: 'ta' }), swap({ id: 'theirs', side: 'b', token: 'tb', confirmedAt: undefined }), swap({ id: 'old', token: 'tc', gone: true })]);
  assert.deepEqual(jobs, [
    { id: 'mine', token: 'ta' },
    { id: 'theirs', token: 'tb' },
  ]);
});

test('swaps survive a backup round trip, and a restore keeps entries not sent yet', () => {
  const s = swap({ entries: [e('b', 'result', 100)] });
  const back = parseBackup(JSON.stringify(buildBackup({ hands: [], sessions: [], players: [], swaps: [s, { id: 'broken' } as unknown as Swap], settings: DEFAULT_SETTINGS })));
  assert.equal(back.swaps?.length, 1);
  assert.equal(back.swaps?.[0].token, 'tok');

  const pending = e('a', 'result', 5, { pending: true, cid: 'p9' });
  const local = [swap({ updatedAt: 1, entries: [pending] })];
  const fresh = mergeSwaps(local, [swap({ updatedAt: 5, entries: [e('b', 'result', 100)] }), swap({ id: 'new' })]);
  assert.equal(fresh.added, 1);
  const merged = fresh.list.find((x) => x.id === 's1')!;
  assert.equal(merged.entries.length, 2);
  assert.ok(merged.entries.some((x) => x.cid === 'p9'));
  assert.equal(mergeSwaps(local, [swap({ updatedAt: 0 })]).list, local);
});
