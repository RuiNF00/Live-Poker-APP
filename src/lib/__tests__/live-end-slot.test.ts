/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { endedSince, liveSlot } from '../live-end-slot';

const key = new Uint8Array(32).fill(7);

test('liveSlot is stable, 32 hex chars, and hides the session id', () => {
  const a = liveSlot(key, 's1');
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(liveSlot(key, 's1'), a);
  assert.notEqual(liveSlot(key, 's2'), a);
  assert.notEqual(liveSlot(new Uint8Array(32).fill(8), 's1'), a);
  assert.ok(!a.includes('s1'));
});

test('endedSince: running before, then ended or gone', () => {
  const before = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', endedAt: 1 }];
  const after = [{ id: 'a' }, { id: 'b', endedAt: 5 }, { id: 'd', endedAt: 1 }];
  assert.deepEqual(endedSince(before, after), ['b', 'c']);
  assert.deepEqual(endedSince([], after), []);
});
