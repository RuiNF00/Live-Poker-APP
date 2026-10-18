/// <reference types="node" />
// The root crash screen's "save a copy": every record comes out raw (even one
// that crashes the app or is too big to read with the rest), and none of the
// app's own secrets do.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isRecordKey, readRecords, rescueFile } from '../rescue';
import { FakeStorage } from './fake-storage';

test('records in, app keys out', () => {
  for (const k of ['rl.hands.v2', 'rl.hand.v2.h1', 'rl.hands.v1', 'rl.sessions.v2', 'rl.session.v2.s1', 'rl.player.v2.p', 'rl.settings.v1', 'rl.draft.v1', 'rl.quarantine.v1.1.rl.hand.v2.x', 'rl.swap.v1.a', 'rl.swapgroups.v1', 'rl.festivalPlans.v1', 'rl.weekly.v1', 'rl.backed.v1.b', 'rl.trip.v1.t'])
    assert.ok(isRecordKey(k), k);
  for (const k of ['rl.cloud.v1', 'sweatbook.cloud.v1', 'rl.coach.v1', 'rl.createKeys.v1', 'rl.outbox.v1', 'rl.ref.v1', 'rl.install.v1', 'sweatbook.app-lock.v1', 'rl.packs.v1', 'rl.crash.v1'])
    assert.ok(!isRecordKey(k), k);
});

test('raw values, even unreadable JSON; one oversized row does not hide the rest', async () => {
  const kv = new FakeStorage({ rowLimit: 50 });
  kv.data.set('rl.hands.v2', '["h1","h2"]');
  kv.data.set('rl.hand.v2.h1', '{"id":"h1"');
  kv.data.set('rl.hand.v2.h2', 'x'.repeat(60));
  kv.data.set('rl.cloud.v1', '{"key":"secret"}');
  const rows = await readRecords(kv);
  assert.deepEqual(rows, [
    ['rl.hand.v2.h1', '{"id":"h1"'],
    ['rl.hands.v2', '["h1","h2"]'],
  ]);
  const file = JSON.parse(rescueFile(rows, { version: '1.0.0', platform: 'ios' }, 5));
  assert.equal(file.kind, 'rescue');
  assert.equal(file.exportedAt, 5);
  assert.deepEqual(file.records[0], { key: 'rl.hand.v2.h1', raw: '{"id":"h1"' });
  assert.ok(!JSON.stringify(file).includes('secret'));
});

test('storage that cannot list keys gives an empty copy, never a throw', async () => {
  const kv = { getAllKeys: async () => Promise.reject(new Error('x')), multiGet: async () => [], getItem: async () => null };
  assert.deepEqual(await readRecords(kv), []);
});
