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

function fakeApi(fail?: unknown, failOnce = false) {
  const saved: (Swap | SwapGroup)[] = [];
  const keys: unknown[] = [];
  const ids: unknown[] = [];
  const boom = () => {
    if (!fail) return;
    const e = fail;
    if (failOnce) fail = undefined;
    throw e;
  };
  const api: CreateApi = {
    async createSwap(terms, _rc, key, id) {
      keys.push(key);
      ids.push(id);
      boom();
      return { swap: { id: id ?? 'S1', terms, confirmedAt: null, confirmedName: null, entries: [], you: 'a', updatedAt: '2026-10-17T21:00:00Z' } as never, token: key };
    },
    async createGroup(terms, names, _rc, ks, id) {
      keys.push(ks);
      ids.push(id);
      boom();
      return { group: { id: id ?? 'G1', terms, seats: names.map((name, seat) => ({ seat, name, confirmedAt: seat ? null : '2026-10-17T21:00:00Z' })), entries: [], you: 0, updatedAt: '2026-10-17T21:00:00Z' }, token: ks.token, invite: ks.invite };
    },
    async confirmSwap(id, name, key) {
      keys.push(key);
      boom();
      return { swap: { id, terms: pairTerms, confirmedAt: '2026-10-17T21:05:00Z', confirmedName: name, entries: [], code: 'AB12', you: 'b', updatedAt: '2026-10-17T21:05:00Z' } as never, token: key };
    },
    async claimSeat(id, _invite, seat, key) {
      keys.push(key);
      boom();
      return { group: { id, terms: groupTerms, seats: ['Rui', 'Ana', 'João'].map((name, s) => ({ seat: s, name, confirmedAt: s === 0 || s === seat ? '2026-10-17T21:00:00Z' : null })), entries: [], you: seat, updatedAt: '2026-10-17T21:05:00Z' }, token: key };
    },
    saveSwap: (s) => void saved.push(s),
    saveGroup: (g) => void saved.push(g),
  };
  return { api, saved, keys, ids };
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

const swapErr = (status: number, code: string) => Object.assign(new Error(code), { status, code });

test('the link sent without signal: the create carries its id, and the swap keeps it', async () => {
  const f = fakeApi();
  assert.equal(await runCreate({ ...pair, id: 'b5b29b12c34491ac' }, f.api), 'done');
  assert.deepEqual(f.ids, ['b5b29b12c34491ac']);
  assert.equal(f.saved[0].id, 'b5b29b12c34491ac');
  assert.equal(await runCreate({ ...group, id: '0123456789abcdef' }, f.api), 'done');
  assert.equal(f.saved[1].id, '0123456789abcdef');
});

test('an id another swap has (two keys, one id): made anyway, with the id the server picks', async () => {
  const f = fakeApi(swapErr(409, 'id_taken'), true);
  assert.equal(await runCreate({ ...pair, id: 'b5b29b12c34491ac' }, f.api), 'done');
  assert.deepEqual(f.ids, ['b5b29b12c34491ac', undefined]);
  assert.equal(f.saved[0].id, 'S1');
  // Any other 409 is a refusal, and without an id there's nothing to retry.
  assert.equal(await runCreate({ ...pair, id: 'b5b29b12c34491ac' }, fakeApi(swapErr(409, 'other')).api), 'drop');
  assert.equal(await runCreate(pair, fakeApi(swapErr(409, 'id_taken')).api), 'drop');
});

const confirm: CreateJob = { kind: 'confirm', id: 'S9', key: k('d'), name: 'Ana', title: 'Main', with: 'Rui' };
const claim: CreateJob = { kind: 'claim', id: 'G9', key: k('e'), invite: k('f'), seat: 2, title: 'Bahamas', players: 3 };

test('confirmed or joined without signal: goes out with the screen key, and lands as my side or seat', async () => {
  const f = fakeApi();
  assert.equal(await runCreate(confirm, f.api), 'done');
  const s = f.saved[0] as Swap;
  assert.equal(s.id, 'S9');
  assert.equal(s.side, 'b');
  assert.equal(s.token, k('d'));
  assert.equal(await runCreate(claim, f.api), 'done');
  const g = f.saved[1] as SwapGroup;
  assert.equal(g.id, 'G9');
  assert.equal(g.seat, 2);
  assert.equal(g.token, k('e'));
  assert.deepEqual(f.keys, [k('d'), k('e')]);
});

test('confirm or seat: no signal waits; someone else got there first is dropped, nothing saved', async () => {
  assert.equal(await runCreate(confirm, fakeApi(new TypeError('Network request failed')).api), 'retry');
  const taken = fakeApi(swapErr(409, 'already_confirmed'));
  assert.equal(await runCreate(confirm, taken.api), 'drop');
  assert.equal(taken.saved.length, 0);
  assert.equal(await runCreate(claim, fakeApi(swapErr(409, 'seat_taken')).api), 'drop');
  assert.equal(await runCreate(claim, fakeApi(swapErr(502, 'http_502')).api), 'retry');
});

test('the waiting list: a confirm shows who proposed it, a seat how many play; one per screen key', () => {
  assert.deepEqual(pendingOf(confirm, 7), { key: k('d'), group: false, title: 'Main', with: 'Rui', at: 7, of: 'S9' });
  assert.deepEqual(pendingOf(claim, 8), { key: k('e'), group: true, title: 'Bahamas', with: '3', at: 8, of: 'G9' });
  assert.equal(jobKey(confirm), k('d'));
  const link = { url: 'https://sweatbook.poker/swap/b5b29b12c34491ac', message: 'Swap…' };
  assert.deepEqual(pendingOf(pair, 9, link).link, link);
});
