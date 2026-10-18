/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GRACE_MS, lockoutMs, needsUnlock, validPin } from '../app-lock-core';

test('locks on launch and after the grace period away, never when off', () => {
  const cfg = { mode: 'device' as const };
  assert.equal(needsUnlock(null, null, 0), false);
  assert.equal(needsUnlock(cfg, null, 0), true); // cold start
  assert.equal(needsUnlock(cfg, 1000, 1000 + GRACE_MS - 1), false);
  assert.equal(needsUnlock(cfg, 1000, 1000 + GRACE_MS), true);
});

test('wrong PINs: free tries, then waits that double up to a cap', () => {
  assert.equal(lockoutMs(4), 0);
  assert.equal(lockoutMs(5), 30000);
  assert.equal(lockoutMs(6), 60000);
  assert.equal(lockoutMs(30), 15 * 60000);
});

test('PIN is exactly 4 digits', () => {
  assert.ok(validPin('0427'));
  assert.ok(!validPin('427'));
  assert.ok(!validPin('04a7'));
  assert.ok(!validPin('04271'));
});

test('readLock fails closed: a read error or a damaged value locks with the phone, nothing is deleted', async () => {
  const { readLock, UNKNOWN_LOCK } = await import('../app-lock-core');
  let cleared = 0;
  const io = (over: Partial<import('../app-lock-core').LockIO>) => ({
    read: async () => JSON.stringify({ mode: 'pin', salt: 's', pinHash: 'h' }),
    installKeys: async () => [['m', '1']] as [string, string | null][],
    markInstalled: async () => {},
    clear: async () => void cleared++,
    ...over,
  });
  // Keychain error, storage error, damaged JSON, wrong shape: locked, asked with the phone's own lock.
  assert.deepEqual(await readLock(io({ read: async () => { throw new Error('keychain'); } })), UNKNOWN_LOCK);
  assert.deepEqual(await readLock(io({ installKeys: async () => { throw new Error('storage'); } })), UNKNOWN_LOCK);
  assert.deepEqual(await readLock(io({ read: async () => '{not json' })), UNKNOWN_LOCK);
  assert.deepEqual(await readLock(io({ read: async () => JSON.stringify({ mode: 'pin' }) })), UNKNOWN_LOCK);
  assert.equal(cleared, 0);
  // The normal cases are unchanged.
  assert.deepEqual(await readLock(io({})), { mode: 'pin', salt: 's', pinHash: 'h' });
  assert.equal(await readLock(io({ read: async () => null })), null);
  // A deleted install's leftover still goes, even if clearing it fails.
  assert.equal(await readLock(io({ installKeys: async () => [['m', null], ['rl.hands.v2', null]], clear: async () => { throw new Error('x'); } })), null);
});

test('a lock turned on before any data: the first-run answers say this install was used, a launch-time "{}" does not', async () => {
  const { lockIsThisInstalls } = await import('../app-lock-core');
  const answers = JSON.stringify({ goals: [], plays: null, volume: null });
  assert.equal(lockIsThisInstalls(null, [['rl.hands.v2', null], ['rl.onboarding.v1', answers]]), true);
  assert.equal(lockIsThisInstalls(null, [['rl.onboarding.v1', JSON.stringify({ goals: ['leaks'], plays: 'mtt1', volume: 'some' })]]), true);
  // A fresh reinstall writes '{}' when it opens the welcome flow: still a leftover lock.
  assert.equal(lockIsThisInstalls(null, [['rl.onboarding.v1', '{}']]), false);
  assert.equal(lockIsThisInstalls(null, [['rl.onboarding.v1', 'not json']]), false);
  assert.equal(lockIsThisInstalls(null, [['rl.onboarding.v1', null]]), false);
});
