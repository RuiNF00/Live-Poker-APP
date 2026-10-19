/// <reference types="node" />
// An entry I delete without signal goes from this phone at once and stays gone while the server
// still has it; the other player's entries and my pending ones are never touched. A bad list of
// waiting deletes in a saved swap is dropped, never the swap.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fixSwap, fixSwapGroup } from '../swap-validate';
import { mergeRemoteGroup, type GroupEntry, type RemoteGroup, type SwapGroup } from '../swap-groups';
import { mergeRemote, swapLedger, type RemoteSwap, type Swap, type SwapEntry } from '../swaps';

const tok = 'f'.repeat(64);
const terms = { v: 1, scope: 'series', title: 'Série', venue: '', currency: '€', a: { name: 'Ana', pct: 10 }, b: { name: 'Bruno', pct: 10 }, note: '', createdAt: 1 } as const;
const e = (side: 'a' | 'b', kind: SwapEntry['kind'], amount: number, id: string, pending?: boolean): SwapEntry => ({ id, cid: id, side, kind, amount, event: '', finish: null, at: 1, ...(pending ? { pending } : {}) });
const swap = (entries: SwapEntry[], over: Partial<Swap> = {}): Swap => ({ id: 'Ab12Cd34', token: tok, side: 'a', terms, entries, confirmedAt: 1, createdAt: 1, updatedAt: 1, ...over });
const remote = (entries: SwapEntry[]): RemoteSwap => ({ id: 'Ab12Cd34', terms, confirmedAt: new Date(1).toISOString(), confirmedName: 'Bruno', entries, code: null, you: 'a', updatedAt: new Date(2).toISOString() }) as RemoteSwap;

test('my entry deleted without signal stays out of a sync that still has it; theirs and my pending stay', () => {
  const mine = e('a', 'result', 1000, 'm1');
  const theirs = e('b', 'result', 2000, 'm1');
  const pending = e('a', 'payment', 50, 'p1', true);
  const local = swap([theirs, pending], { removing: ['m1'] });
  const next = mergeRemote(local, remote([mine, theirs]), 5);
  assert.deepEqual(next.entries.map((x) => `${x.side}:${x.id}`).sort(), ['a:p1', 'b:m1'], 'the other side’s entry with the same id stays');
  assert.deepEqual(next.removing, ['m1'], 'still waiting until the server deletes it');
  // The accounts on this phone already count it as gone.
  assert.equal(swapLedger(next).balance, swapLedger(swap([theirs, pending])).balance);
  // Once the server has deleted it, nothing changes and nothing comes back.
  const after = mergeRemote({ ...next, removing: undefined }, remote([theirs]), 6);
  assert.deepEqual(after.entries.map((x) => `${x.side}:${x.id}`).sort(), ['a:p1', 'b:m1']);
});

test('nothing waiting: the server copy as before', () => {
  const r = remote([e('a', 'result', 1000, 'm1')]);
  assert.deepEqual(mergeRemote(swap([]), r, 5).entries.map((x) => x.id), ['m1']);
});

const gterms = { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: 1 } as const;
const ge = (seat: number, id: string, pending?: boolean): GroupEntry => ({ id, cid: id, seat, kind: 'result', amount: 1000, event: '', finish: null, at: 1, ...(pending ? { pending } : {}) });
const group = (entries: GroupEntry[], over: Partial<SwapGroup> = {}): SwapGroup => ({ id: 'Gr3dE6gH9k', token: tok, seat: 1, terms: gterms, seats: [], entries, createdAt: 1, updatedAt: 1, ...over });
const gremote = (entries: GroupEntry[]): RemoteGroup => ({ id: 'Gr3dE6gH9k', terms: gterms, seats: [{ seat: 0, name: 'Rui', confirmedAt: null }, { seat: 1, name: 'Ana', confirmedAt: null }], entries, you: 1, updatedAt: new Date(2).toISOString() }) as RemoteGroup;

test('group: my entry deleted without signal stays out; other seats keep theirs', () => {
  const next = mergeRemoteGroup(group([ge(1, 'p', true)], { removing: ['x'] }), gremote([ge(1, 'x'), ge(0, 'x'), ge(1, 'y')]), 5);
  assert.deepEqual(next.entries.map((x) => `${x.seat}:${x.id}`).sort(), ['0:x', '1:p', '1:y']);
});

test('a saved swap or group with a broken waiting list loads without it; a good list stays', () => {
  const s = swap([], { removing: ['m1', 'abc-DEF_9'] });
  assert.equal(fixSwap(s), s);
  for (const bad of [['../x'], [1], 'm1', [''], ['x'.repeat(65)]]) {
    const fixed = fixSwap({ ...s, removing: bad });
    assert.ok(fixed, JSON.stringify(bad));
    assert.equal('removing' in fixed!, false, JSON.stringify(bad));
  }
  const g = group([], { removing: ['../../x'] });
  const fixedG = fixSwapGroup(g);
  assert.ok(fixedG);
  assert.equal('removing' in fixedG!, false);
});
