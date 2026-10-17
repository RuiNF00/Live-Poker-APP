/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CloudState } from '../cloud-code';
import { autoBackup, countsOf, uploadBlock } from '../cloud-guard';

const H = 3600000;
const code = { id: '0123456789', secret: 'ABCDEFGHJKMNPQRS' };
const empty = countsOf({});
const full = { hands: 120, sessions: 14, players: 9, backers: 2, packages: 3, payments: 4, transfers: 6 };

test('restore race: launch auto-backup never sends the not-yet-loaded phone', () => {
  // New phone: app opens, user restores in the first seconds.
  const t0 = 1_000_000_000_000;
  // Timer fires before the restore finished: no code saved yet.
  assert.equal(autoBackup(null, empty, t0 + 4000), 'skip');
  // Restore done; the timer reads the store before the import re-rendered.
  const restored: CloudState = { ...code, lastAt: t0 + 3000, counts: full };
  assert.equal(autoBackup(restored, empty, t0 + 4000), 'skip');
  // App closed before the restored hands were written to the phone; next
  // launch, hours later, the phone holds only what it had before (or nothing).
  assert.equal(autoBackup(restored, empty, t0 + 7 * H), 'skip');
  assert.equal(autoBackup(restored, { hands: 3, players: 1 }, t0 + 7 * H), 'skip');
  assert.equal(autoBackup(restored, { ...full, hands: 0 }, t0 + 7 * H), 'skip');
  // Fully loaded plus a new hand: the normal 6-hourly backup goes out.
  assert.equal(autoBackup(restored, { ...full, hands: 121 }, t0 + 7 * H), 'upload');
  assert.equal(autoBackup(restored, { ...full, hands: 121 }, t0 + 5 * H), 'skip');
});

test('deleting things on purpose does not stop backups', () => {
  const t0 = 1_000_000_000_000;
  // QA repro: counts {3,1,2}, delete one player note, add 10 hands.
  const c: CloudState = { ...code, lastAt: t0, counts: { hands: 3, sessions: 1, players: 2 } };
  assert.equal(autoBackup(c, { hands: 13, sessions: 1, players: 1 }, t0 + 7 * H), 'upload');
  // A few hands and a whole backer's staking gone: still well over half.
  const big: CloudState = { ...code, lastAt: t0, counts: full };
  assert.equal(autoBackup(big, { ...full, hands: 110, backers: 1, packages: 1, payments: 0 }, t0 + 7 * H), 'upload');
});

test('upload() rule: empty or under half never replaces the server copy unless forced', () => {
  assert.equal(uploadBlock(empty, code), 'would_shrink'); // older phones: no counts saved
  assert.equal(uploadBlock({ hands: 1 }, code), null);
  assert.equal(uploadBlock({ payments: 1 }, code), null); // staking-only players count too
  const known: CloudState = { ...code, counts: full };
  assert.equal(uploadBlock(empty, known), 'would_shrink');
  assert.equal(uploadBlock({ hands: 30, sessions: 14, players: 9 }, known), 'would_shrink'); // 53 of 158
  assert.equal(uploadBlock(full, known), null);
  // Counts saved by #27 (hands, sessions, players only) still work.
  assert.equal(uploadBlock({ hands: 1 }, { ...code, counts: { hands: 10, sessions: 0, players: 0 } }), 'would_shrink');
  // Brand-new code, or the user confirmed deleting things on purpose.
  assert.equal(uploadBlock(empty, known, true), null);
});

test('trips count: a phone without the cloud copy\'s trips is not "more" than it', () => {
  assert.equal(countsOf({ trips: [{}, {}] }).trips, 2);
  const c: CloudState = { ...code, lastAt: 1, counts: { sessions: 4, trips: 6 } };
  assert.equal(uploadBlock(countsOf({ sessions: [{}, {}, {}, {}] }), c), 'would_shrink');
  assert.equal(uploadBlock(countsOf({ sessions: [{}, {}, {}, {}], trips: [{}, {}, {}, {}, {}, {}] }), c), null);
});
