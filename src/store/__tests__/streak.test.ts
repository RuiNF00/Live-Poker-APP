/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeStreak, weekStart } from '../streak';

// Wednesday 2026-10-14 12:00 local.
const now = new Date(2026, 9, 14, 12).getTime();
const wk = (n: number, day = 2) => new Date(2026, 9, 14 - 7 * n + (day - 2), 10).getTime();

test('weekStart is Monday midnight', () => {
  const d = new Date(weekStart(now));
  assert.equal(d.getDay(), 1);
  assert.equal(d.getDate(), 12);
  assert.equal(weekStart(new Date(2026, 9, 18, 23).getTime()), weekStart(now));
});

test('nothing logged: no streak, first milestone 2', () => {
  const s = computeStreak([], [], now);
  assert.equal(s.weeks, 0);
  assert.equal(s.next, 2);
  assert.equal(s.recent.length, 12);
});

test('current week not logged yet keeps last weeks streak', () => {
  const s = computeStreak([wk(1), wk(2), wk(3)], [], now);
  assert.equal(s.weeks, 3);
  assert.equal(s.loggedThisWeek, false);
  assert.equal(s.recent.at(-1), 'empty');
});

test('a missed week without a freeze resets', () => {
  const s = computeStreak([wk(0), wk(2), wk(3)], [], now);
  assert.equal(s.weeks, 1);
});

test('four weeks earn a freeze that covers one missed week', () => {
  const s = computeStreak([wk(0), wk(2), wk(3), wk(4), wk(5)], [], now);
  assert.equal(s.weeks, 5);
  assert.equal(s.freezes, 0);
  assert.deepEqual(s.recent.slice(-3), ['logged', 'frozen', 'logged']);
});

test('paused weeks neither break nor count', () => {
  const s = computeStreak([wk(0), wk(3)], [{ from: wk(2, 0), to: wk(1, 6) }], now);
  assert.equal(s.weeks, 2);
  assert.deepEqual(s.recent.slice(-4), ['logged', 'paused', 'paused', 'logged']);
});

test('open pause covers the current week', () => {
  const s = computeStreak([wk(1)], [{ from: wk(0, 0) }], now);
  assert.equal(s.paused, true);
  assert.equal(s.weeks, 1);
});

test('next milestone is the first above the streak', () => {
  const s = computeStreak([wk(0), wk(1), wk(2)], [], now);
  assert.equal(s.next, 4);
});
