/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_PACK_HANDS, packEraseJobs, packHands, parsePacks, type HandPack } from '../pack-core';
import { KEEP_KEYS, keysToErase } from '../erase-core';
import type { Hand } from '../../poker/types';

const pack = (over: Partial<HandPack> = {}): HandPack => ({
  id: 'abcdef012345', ownerToken: 'b'.repeat(64), url: 'https://sweatbook.poker/p/abcdef012345', title: 'Main Event', handIds: ['h1', 'h2'], hideAmounts: true, createdAt: 1, ...over,
});

test('stored packs survive a round trip and junk is dropped', () => {
  assert.deepEqual(parsePacks(JSON.parse(JSON.stringify([pack(), { id: 1 }, null]))), [pack()]);
  assert.deepEqual(parsePacks('x'), []);
});

test('erase everything deletes every pack on the server and the local list', () => {
  assert.deepEqual(packEraseJobs([pack()]), [{ kind: 'pack-delete', payload: { id: 'abcdef012345', ownerToken: 'b'.repeat(64) }, key: 'abcdef012345' }]);
  assert.ok(!KEEP_KEYS.includes('rl.packs.v1'));
  assert.ok(keysToErase(['rl.packs.v1']).includes('rl.packs.v1'));
});

test('only complete hands go, oldest first, the latest MAX_PACK_HANDS', async () => {
  const { sampleHand } = await import('../../poker/sample');
  const done = Array.from({ length: MAX_PACK_HANDS + 2 }, (_, i) => ({ ...sampleHand(`h${i}`), createdAt: 1000 - i }));
  const open: Hand = { ...done[0], id: 'open', createdAt: 5000, actions: [] };
  const r = packHands([open, ...done]);
  assert.equal(r.left, 1);
  assert.equal(r.extra, 2);
  assert.equal(r.send.length, MAX_PACK_HANDS);
  assert.ok(r.send.every((h, i) => i === 0 || h.createdAt >= r.send[i - 1].createdAt));
  assert.ok(!r.send.some((h) => h.id === 'open'));
});
