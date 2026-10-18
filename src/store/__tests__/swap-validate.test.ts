/// <reference types="node" />
// Swaps and group swaps are checked at launch like sessions: every saved shape loads,
// one that a screen would crash on goes to quarantine and the rest of the app opens.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadCollection, type CollectionSpec, type KV } from '../persist';
import { fixSwap, fixSwapGroup } from '../swap-validate';

const T = Date.UTC(2026, 9, 17, 12);
const tok = 'f'.repeat(64);

function mem(entries: [string, unknown][]): KV {
  const m = new Map(entries.map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getItem: async (k) => m.get(k) ?? null,
    multiGet: async (keys) => keys.map((k) => [k, m.get(k) ?? null] as const),
    multiSet: async (pairs) => pairs.forEach(([k, v]) => m.set(k, v)),
    multiRemove: async (keys) => keys.forEach((k) => m.delete(k)),
    getAllKeys: async () => [...m.keys()],
  };
}

// a03c6093 shape.
const swap = {
  id: 'Ab12Cd34', token: tok, side: 'a',
  terms: { v: 1, scope: 'event', title: 'Main Event', venue: 'Estoril', currency: '€', a: { name: 'Rui', pct: 5 }, b: { name: 'Ana', pct: 5 }, note: '', createdAt: T },
  confirmedAt: T, confirmedName: 'Ana',
  entries: [{ id: 'e1', cid: 'c1', side: 'a', kind: 'result', event: 'Main Event', amount: 1000, finish: 7, at: T, pending: true }],
  createdAt: T, updatedAt: T,
};
// 7b8bb788 shape (first group swaps), with a player who left ("-").
const group = {
  id: 'Gr3dE6gH9k', token: tok, seat: 0, invite: tok,
  terms: { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: T },
  seats: [{ seat: 0, name: 'Rui', confirmedAt: T }, { seat: 1, name: 'Ana' }, { seat: 2, name: '-' }],
  entries: [{ id: 'g1', cid: 'gc1', seat: 1, kind: 'result', amount: 1000, event: '', finish: null, at: T }, { id: 'g2', cid: 'gc2', seat: 0, kind: 'payment', amount: 20, event: '', finish: null, to: 1, at: T }],
  createdAt: T, updatedAt: T,
};

test('every saved swap and group swap shape passes unchanged', () => {
  assert.equal(fixSwap(swap), swap);
  assert.equal(fixSwapGroup(group), group);
});

test('a broken swap or group goes to quarantine at launch; the good ones load', async () => {
  const S: CollectionSpec = { index: 'rl.swaps.v1', prefix: 'rl.swap.v1.' };
  const G: CollectionSpec = { index: 'rl.swapgroups.v1', prefix: 'rl.swapgroup.v1.' };
  const badSwaps = [
    { ...swap, id: 'Bad00001', terms: null },
    { ...swap, id: 'Bad00002', entries: [null] },
    { ...swap, id: 'Bad00003', terms: { ...swap.terms, a: null } },
    { ...swap, id: 'Bad00004', side: 'c' },
  ];
  const badGroups = [
    { ...group, id: 'BadG0001', seats: 'x' },
    { ...group, id: 'BadG0002', entries: [{ ...group.entries[0], seat: 9 }] },
    { ...group, id: 'BadG0003', terms: { ...group.terms, pct: 'x' } },
  ];
  const kv = mem([
    [S.index, [swap.id, ...badSwaps.map((x) => x.id)]],
    [swap.id ? S.prefix + swap.id : '', swap],
    ...badSwaps.map((x) => [S.prefix + x.id, x] as [string, unknown]),
    [G.index, [group.id, ...badGroups.map((x) => x.id)]],
    [G.prefix + group.id, group],
    ...badGroups.map((x) => [G.prefix + x.id, x] as [string, unknown]),
  ]);
  const s = await loadCollection(kv, S, { fix: fixSwap });
  assert.deepEqual(s.items.map((x) => x.id), [swap.id]);
  assert.deepEqual(s.bad.map(([k]) => k).sort(), badSwaps.map((x) => S.prefix + x.id).sort());
  const g = await loadCollection(kv, G, { fix: fixSwapGroup });
  assert.deepEqual(g.items.map((x) => x.id), [group.id]);
  assert.equal(g.bad.length, badGroups.length);
});
