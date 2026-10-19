import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blockReason, noteAsk, noteDay, type ReviewNow, type ReviewState } from '../review-core';

const D = 86_400_000;
const T0 = new Date(2026, 9, 1, 15).getTime();
const used = (): ReviewState => [0, 1, 2].reduce((s, i) => noteDay(s, T0 + i * D), { installedAt: T0, days: [], asks: [], versions: [] } as ReviewState);
const ok = (over: Partial<ReviewNow> = {}): ReviewNow => ({ now: T0 + 4 * D, version: '1.0.0', hands: 8, live: false, recentLoss: false, error: false, overlay: false, ...over });

test('asks an engaged player at a good moment', () => {
  assert.equal(blockReason(used(), ok()), null);
});

test('who: 3 days installed, 3 days used, 5 hands', () => {
  assert.equal(blockReason(used(), ok({ now: T0 + 2 * D })), 'new-install');
  assert.equal(blockReason({ ...used(), days: ['2026-10-01'] }, ok()), 'few-days');
  assert.equal(blockReason(used(), ok({ hands: 4 })), 'few-hands');
});

test('not now: live session, loss, paywall, cancel, purchase, error, overlay', () => {
  const s = used();
  const now = T0 + 4 * D;
  assert.equal(blockReason(s, ok({ live: true })), 'live-session');
  assert.equal(blockReason(s, ok({ recentLoss: true })), 'recent-loss');
  assert.equal(blockReason({ ...s, paywallAt: now - 3_600_000 }, ok()), 'paywall');
  assert.equal(blockReason({ ...s, cancelAt: now - 20 * D }, ok()), 'cancel');
  assert.equal(blockReason({ ...s, boughtAt: now - 47 * 3_600_000 }, ok()), 'bought');
  assert.equal(blockReason({ ...s, boughtAt: now - 49 * 3_600_000 }, ok()), null);
  assert.equal(blockReason(s, ok({ error: true })), 'error');
  assert.equal(blockReason(s, ok({ overlay: true })), 'overlay');
});

test('limits: once per version, 120 days apart, 3 a year', () => {
  let s = noteAsk(used(), ok());
  assert.equal(blockReason(s, ok({ now: T0 + 200 * D })), 'this-version');
  assert.equal(blockReason(s, ok({ now: T0 + 100 * D, version: '1.1.0' })), 'gap');
  assert.equal(blockReason(s, ok({ now: T0 + 130 * D, version: '1.1.0' })), null);
  s = { ...s, asks: [T0, T0 + 121 * D, T0 + 242 * D] };
  assert.equal(blockReason(s, ok({ now: T0 + 363 * D, version: '2.0.0' })), 'year');
});

test('days used are counted once each and capped', () => {
  let s: ReviewState = { installedAt: T0, days: [], asks: [], versions: [] };
  s = noteDay(noteDay(s, T0), T0 + 3_600_000);
  assert.deepEqual(s.days, ['2026-10-01']);
  for (let i = 1; i < 10; i++) s = noteDay(s, T0 + i * D);
  assert.equal(s.days.length, 3);
});
