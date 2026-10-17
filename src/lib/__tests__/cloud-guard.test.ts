/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CloudState } from '../cloud-code';
import { autoBackup, uploadBlock } from '../cloud-guard';

const H = 3600000;
const code = { id: '0123456789', secret: 'ABCDEFGHJKMNPQRS' };
const empty = { hands: 0, sessions: 0, players: 0 };
const full = { hands: 120, sessions: 14, players: 9 };

test('restore race: launch auto-backup never sends the not-yet-loaded phone', () => {
  // New phone: app opens, user restores in the first seconds.
  const t0 = 1_000_000_000_000;
  // Timer fires before the restore finished: no code saved yet.
  assert.equal(autoBackup(null, empty, t0 + 4000), 'skip');
  // Restore done; the timer reads the store before the import re-rendered.
  const restored: CloudState = { ...code, lastAt: t0 + 3000, counts: full };
  assert.equal(autoBackup(restored, empty, t0 + 4000), 'skip');
  // App closed before the restored hands were written to the phone; next
  // launch, hours later, the phone holds only part of them (or nothing).
  assert.equal(autoBackup(restored, empty, t0 + 7 * H), 'skip');
  assert.equal(autoBackup(restored, { hands: 3, sessions: 0, players: 0 }, t0 + 7 * H), 'skip');
  assert.equal(autoBackup(restored, { ...full, hands: 119 }, t0 + 7 * H), 'skip');
  // Fully loaded plus a new hand: the normal 6-hourly backup goes out.
  assert.equal(autoBackup(restored, { ...full, hands: 121 }, t0 + 7 * H), 'upload');
  assert.equal(autoBackup(restored, { ...full, hands: 121 }, t0 + 5 * H), 'skip');
});

test('upload() rule: empty or smaller never replaces the server copy unless forced', () => {
  assert.equal(uploadBlock(empty, code), 'would_shrink'); // older phones: no counts saved
  assert.equal(uploadBlock({ hands: 1, sessions: 0, players: 0 }, code), null);
  const known: CloudState = { ...code, counts: full };
  assert.equal(uploadBlock(empty, known), 'would_shrink');
  assert.equal(uploadBlock({ ...full, players: 8 }, known), 'would_shrink');
  assert.equal(uploadBlock(full, known), null);
  // Brand-new code, or the user confirmed deleting things on purpose.
  assert.equal(uploadBlock(empty, known, true), null);
});
