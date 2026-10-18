/// <reference types="node" />
// Its own file: the shipped schedules load once per process, and here they must start unloaded.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FESTIVALS, loadShippedFestivals } from '../../poker/festivals';
import { allFestivals, loadOwnFestivals, ownFestival } from '../my-festivals';

const own = ownFestival('fx_1', { name: 'Malta, novembro 2026', city: 'St. Julian’s', currency: '€', from: '2026-11-05', to: '2026-11-12' });
const m = new Map([['rl.myFestivals.v1', JSON.stringify([own])]]);
(globalThis as { window?: unknown }).window = {
  localStorage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) },
};

test("the player's own festivals load when the later schedules don't, and those load on the next try", async () => {
  // The chunk fails (web without signal, not cached).
  const failed = loadShippedFestivals(() => Promise.reject(new Error('offline')));
  await loadOwnFestivals();
  await failed;
  assert.equal(FESTIVALS.length, 13);
  assert.ok(allFestivals().some((f) => f.id === 'fx_1'));
  // Next try loads them.
  await loadShippedFestivals();
  assert.equal(FESTIVALS.length, 21);
});
