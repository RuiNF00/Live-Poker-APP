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
