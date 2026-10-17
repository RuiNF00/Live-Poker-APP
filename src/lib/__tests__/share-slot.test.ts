/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { takeSlot, type QueueState } from '../share-slot';

const fresh = (): QueueState => ({ waiting: [], ready: {} });

test('nothing pending: upload now', () => {
  assert.deepEqual(takeSlot(fresh(), 'h1', false), { kind: 'upload' });
});

test('reconnect + re-share while the queued upload is in flight: wait, never a second upload', () => {
  // Shared offline: the job is queued and the hand listed as waiting.
  const s: QueueState = { waiting: ['h1'], ready: {} };
  // Signal back, the outbox has already picked the job up (cancel fails), the player taps Share.
  assert.deepEqual(takeSlot(s, 'h1', false), { kind: 'busy' });
  assert.deepEqual(s.waiting, ['h1']);
  // The background upload lands; the next tap reuses its link instead of uploading.
  s.waiting = [];
  s.ready.h1 = { shareId: 'A', shareToken: 'tA' };
  assert.deepEqual(takeSlot(s, 'h1', false), { kind: 'ready', link: { shareId: 'A', shareToken: 'tA' } });
  assert.deepEqual(s.ready, {});
});

test('re-share before the queued upload went out: the job is cancelled, one direct upload', () => {
  const s: QueueState = { waiting: ['h1'], ready: {} };
  assert.deepEqual(takeSlot(s, 'h1', true), { kind: 'upload' });
  assert.deepEqual(s.waiting, []);
});

test('a ready link wins even if the hand is still listed as waiting', () => {
  const s: QueueState = { waiting: ['h1', 'h2'], ready: { h1: { shareId: 'B', shareToken: 'tB' } } };
  assert.equal(takeSlot(s, 'h1', false).kind, 'ready');
  assert.deepEqual(s.waiting, ['h2']);
});

test('other hands are untouched', () => {
  const s: QueueState = { waiting: ['h2'], ready: { h3: { shareId: 'C', shareToken: 'tC' } } };
  assert.equal(takeSlot(s, 'h1', false).kind, 'upload');
  assert.deepEqual(s, { waiting: ['h2'], ready: { h3: { shareId: 'C', shareToken: 'tC' } } });
});
