/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup, parseBackup } from '../backup';
import { DEFAULT_SETTINGS } from '../types';
import { profit } from '../session-math';
import type { Session } from '../types';
import { assignSwaps, newFromOther, swapsForSession, mergeRemote, mergeSwaps, swapDeleteJobs, withSwaps, swapLedger, swapsTotal, type RemoteSwap, type Swap, type SwapEntry, type SwapTerms } from '../swaps';

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
