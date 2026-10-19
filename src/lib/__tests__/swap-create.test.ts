/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SwapGroup } from '../../store/swap-groups';
import type { Swap } from '../../store/swaps';
import { addPending, jobKey, pendingOf, runCreate, type CreateApi, type CreateJob } from '../swap-create-core';

const k = (c: string) => c.repeat(64);
const pairTerms = { v: 1, scope: 'event', title: 'Main', venue: '', currency: '€', a: { name: 'Rui', pct: 5 }, b: { name: 'Ana', pct: 5 }, note: '', createdAt: 1 } as const;
const groupTerms = { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: 1 } as const;
const pair: CreateJob = { kind: 'pair', key: k('a'), terms: pairTerms, rc: 'rc1' };
const group: CreateJob = { kind: 'group', keys: { token: k('b'), invite: k('c') }, terms: groupTerms, names: ['Rui', 'Ana', 'João'] };

function fakeApi(fail?: unknown) {
  const saved: (Swap | SwapGroup)[] = [];
  const keys: unknown[] = [];
  const api: CreateApi = {
    async createSwap(terms, _rc, key) {
      keys.push(key);
      if (fail) throw fail;
      return { swap: { id: 'S1', terms, confirmedAt: null, confirmedName: null, entries: [], you: 'a', updatedAt: '2026-10-17T21:00:00Z' } as never, token: key };
    },
    async createGroup(terms, names, _rc, ks) {
      keys.push(ks);
      if (fail) throw fail;
      return { group: { id: 'G1', terms, seats: names.map((name, seat) => ({ seat, name, confirmedAt: seat ? null : '2026-10-17T21:00:00Z' })), entries: [], you: 0, updatedAt: '2026-10-17T21:00:00Z' }, token: ks.token, invite: ks.invite };
    },
    saveSwap: (s) => void saved.push(s),
    saveGroup: (g) => void saved.push(g),
  };
  return { api, saved, keys };
}

test('a swap made without signal is created with its draft key and saved on the phone', async () => {
  const f = fakeApi();
  assert.equal(await runCreate(pair, f.api), 'done');
  assert.deepEqual(f.keys, [k('a')]);
  assert.equal(f.saved[0].id, 'S1');
  assert.equal((f.saved[0] as Swap).token, k('a'));
  assert.equal((f.saved[0] as Swap).ownerRc, 'rc1');

  assert.equal(await runCreate(group, f.api), 'done');
  assert.deepEqual(f.keys[1], { token: k('b'), invite: k('c') });
  assert.equal((f.saved[1] as SwapGroup).seat, 0);
});

test('no signal or a server hiccup waits; a refusal is dropped', async () => {
  const status = (s: number) => Object.assign(new Error('x'), { status: s });
  assert.equal(await runCreate(pair, fakeApi(new TypeError('Network request failed')).api), 'retry');
  assert.equal(await runCreate(pair, fakeApi(status(503)).api), 'retry');
  assert.equal(await runCreate(pair, fakeApi(status(429)).api), 'retry');
  assert.equal(await runCreate(pair, fakeApi(status(422)).api), 'drop');
  assert.equal(fakeApi(status(422)).saved.length, 0);
});

test('the list of waiting swaps shows who and what, never amounts, one per draft', () => {
  const p = pendingOf(pair, 5);
  assert.deepEqual(p, { key: k('a'), group: false, title: 'Main', with: 'Ana', at: 5 });
  assert.equal(pendingOf(group, 6).with, '3');
  assert.equal(jobKey(group), k('b'));
  const list = addPending(addPending([], p), { ...p, at: 9 });
  assert.equal(list.length, 1);
  assert.equal(list[0].at, 9);
});
