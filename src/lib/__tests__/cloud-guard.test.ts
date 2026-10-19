/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CloudState } from '../cloud-code';
import { autoBackup, BACKUP_MAX_BYTES, backupHealth, CHANGE_DEBOUNCE_MS, changeBackupIn, cloudAhead, countsOf, uploadBlock } from '../cloud-guard';

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

test('backup health: warns when the last copy failed or is a week old, never when it is off', () => {
  const day = 86400000;
  const now = 100 * day;
  assert.deepEqual(backupHealth(null, now), { level: 'ok' });
  assert.deepEqual(backupHealth({ id: 'a', secret: 's', lastAt: now - 6 * day }, now), { level: 'ok' });
  assert.deepEqual(backupHealth({ id: 'a', secret: 's', lastAt: now - 9 * day }, now), { level: 'stale', days: 9 });
  assert.equal(backupHealth({ id: 'a', secret: 's' }, now).level, 'stale');
  assert.deepEqual(backupHealth({ id: 'a', secret: 's', lastAt: now - day, failedAt: now - 1000, failure: 'quota' }, now), { level: 'failed', reason: 'quota' });
  // A copy that worked after the failure clears it.
  assert.deepEqual(backupHealth({ id: 'a', secret: 's', lastAt: now - 1000, failedAt: now - day, failure: 'network' }, now), { level: 'ok' });
});

test('backup health: says so before the copy stops fitting (80 % of the server limit)', () => {
  const day = 86400000;
  const now = 100 * day;
  const at = (share: number) => backupHealth({ id: 'a', secret: 's', lastAt: now - 1000, bytes: Math.round(BACKUP_MAX_BYTES * share) }, now);
  assert.equal(BACKUP_MAX_BYTES, 2 * 1024 * 1024); // same as the server
  assert.deepEqual(at(0.5), { level: 'ok' });
  assert.deepEqual(at(0.79), { level: 'ok' });
  assert.deepEqual(at(0.8), { level: 'near', pct: 80 });
  assert.deepEqual(at(0.876), { level: 'near', pct: 87 });
  // Never 100 % while it still fits.
  assert.deepEqual(at(1), { level: 'near', pct: 99 });
  // Copies made before the size was kept: no warning until the next one.
  assert.deepEqual(backupHealth({ id: 'a', secret: 's', lastAt: now - 1000 }, now), { level: 'ok' });
  // A failure or an old copy says more than the size does.
  assert.deepEqual(backupHealth({ id: 'a', secret: 's', lastAt: now - day, bytes: BACKUP_MAX_BYTES, failedAt: now - 1000, failure: 'too_big' }, now), { level: 'failed', reason: 'too_big' });
  assert.deepEqual(backupHealth({ id: 'a', secret: 's', lastAt: now - 9 * day, bytes: BACKUP_MAX_BYTES }, now), { level: 'stale', days: 9 });
});

test('"Cópia parada" only when the cloud holds a copy: not on the first backup of an empty phone', () => {
  assert.equal(cloudAhead({}, code), false); // just turned on, nothing to copy yet
  assert.equal(uploadBlock({}, code), 'would_shrink'); // and still nothing is uploaded
  assert.equal(cloudAhead({}, { ...code, lastAt: 1, counts: { hands: 3 } }), true); // restore not loaded yet
  assert.equal(cloudAhead({ hands: 3 }, { ...code, lastAt: 1, counts: { hands: 3 } }), false);
});

test('an empty cloud copy (backup just turned on with no data) is nothing to protect', () => {
  const empty: CloudState = { ...code, lastAt: 1, counts: { hands: 0, sessions: 0, players: 0 } };
  assert.equal(uploadBlock({}, empty), null);
  assert.equal(cloudAhead({}, empty), false);
  assert.equal(uploadBlock({ hands: 1 }, empty), null);
});

test('after a saved hand: copy once things settle, at most every 10 minutes, never a smaller phone', () => {
  const t0 = 1_000_000_000_000;
  const c: CloudState = { ...code, lastAt: t0, counts: full };
  assert.equal(changeBackupIn(null, full, t0), null);
  assert.equal(changeBackupIn(c, { ...full, hands: 121 }, t0 + H), CHANGE_DEBOUNCE_MS);
  assert.equal(changeBackupIn(c, { ...full, hands: 121 }, t0 + 60_000), 9 * 60_000);
  assert.equal(changeBackupIn(c, empty, t0 + H), null);
  // Over the server limit: back to one try every 6 hours, not one per hand.
  const big: CloudState = { ...c, failedAt: t0 + H, failure: 'too_big' };
  assert.equal(changeBackupIn(big, { ...full, hands: 121 }, t0 + 2 * H), 5 * H);
  // A network failure doesn't slow it down.
  assert.equal(changeBackupIn({ ...c, failedAt: t0 + H, failure: 'network' }, { ...full, hands: 121 }, t0 + 2 * H), CHANGE_DEBOUNCE_MS);
});
