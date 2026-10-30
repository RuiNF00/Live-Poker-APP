/// <reference types="node" />
// A five-year history: 2 000 sessions and 20 000 hands (scripts/big-history; npm run bench:history
// times the screens' work). What a long history broke or slowed, checked here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { maxOf, minOf } from '../../lib/extent';
import { lastActivity } from '../../lib/welcome-back';
import { drillQueue, dueAgainCount, type DrillState } from '../../poker/drill';
import { needsReview } from '../../poker/review';
import { computeStreak, weekStart, weekStarter } from '../streak';
import { bigSessionsAndHands } from '../../../scripts/big-history';

const HOUR = 3_600_000;
// More than V8 takes as arguments to one call (about 125 000): a regular's hands plus sessions over the years.
const LONG = 200_000;

test('minOf and maxOf: any length, across lists, ±Infinity when empty', () => {
  assert.equal(minOf([3, 1], [2]), 1);
  assert.equal(maxOf([3, 1], [], [7]), 7);
  assert.equal(minOf(), Infinity);
  assert.equal(maxOf([]), -Infinity);
  const long = Array.from({ length: LONG }, (_, i) => i);
  assert.equal(minOf(long), 0);
  assert.equal(maxOf(long), LONG - 1);
});

test('the streak and the last activity survive a history too long to spread into one call', () => {
  const start = Date.UTC(2020, 0, 1);
  const times = Array.from({ length: LONG }, (_, i) => start + i * 15 * 60_000);
  const s = computeStreak(times, [], times[times.length - 1]);
  assert.ok(s.weeks > 200);
  const hands = times.map((createdAt) => ({ createdAt }));
  assert.equal(lastActivity([], hands), times[times.length - 1]);
});

test('weekStarter gives weekStart, in any order, across the clock changes', () => {
  const ws = weekStarter();
  // Every hour for two years, then the same hours shuffled: each answer is weekStart's.
  const from = Date.UTC(2025, 0, 1);
  const hours = Array.from({ length: 2 * 365 * 24 }, (_, i) => from + i * HOUR + 17 * 60_000);
  for (const ts of hours) assert.equal(ws(ts), weekStart(ts));
  for (let i = 0; i < 5000; i++) {
    const ts = hours[(i * 7919) % hours.length];
    assert.equal(ws(ts), weekStart(ts));
  }
});

test('the streak on the big history: the same as from each hand\'s own week', () => {
  const { hands } = bigSessionsAndHands(300, 10);
  const times = hands.map((h) => h.createdAt);
  const now = Date.UTC(2026, 9, 29, 20);
  const s = computeStreak(times, [], now);
  assert.ok(s.weeks > 0);
  assert.deepEqual(s, computeStreak(times.map(weekStart), [], now));
});

test('«para treinar» counts what the drill queue did, without building it', () => {
  const { hands } = bigSessionsAndHands(100, 10);
  const now = Date.UTC(2026, 9, 29, 20);
  const state: DrillState = {};
  hands.forEach((h, i) => {
    if (i % 3 === 0) state[h.id] = { due: now + (i % 2 ? HOUR : -HOUR), done: 1 };
  });
  const marked = hands.map((h, i) => (i % 5 === 0 ? { ...h, review: 'pending' as const } : h));
  const before = drillQueue(marked, state, now, Infinity).filter((h) => !needsReview(h)).length;
  assert.ok(before > 0);
  assert.equal(dueAgainCount(marked, state, now), before);
});

const src = path.join(__dirname, '..', '..');
const read = (f: string) => readFileSync(path.join(src, f), 'utf8');

test('Resumo: the start of the week is worked out once, not once per hand', () => {
  const home = read('app/(tabs)/index.tsx');
  assert.doesNotMatch(home, /createdAt >= weekStart\(now\)/);
  assert.match(home, /const since = weekStart\(now\);\s*return hands\.filter\(\(h\) => h\.createdAt >= since\)\.length;/);
  assert.match(home, /dueAgainCount\(hands, drill, now\)/);
});

test('Mãos: nothing walks every hand on each letter typed but the search itself', () => {
  const list = read('app/(tabs)/hands.tsx');
  // The picked hands, once per change (it was one pass for the folders sheet and one per tag chip).
  assert.equal(list.match(/picked\.has\(h\.id\)/g)?.length, 1);
  assert.match(list, /const pickedHands = useMemo\(\(\) => \(picked\.size \? hands\.filter\(\(h\) => picked\.has\(h\.id\)\) : \[\]\), \[hands, picked\]\);/);
  // Days: the date maths once per day of hands.
  assert.match(list, /if \(h\.createdAt < cur\) \{\s*cur = dayKey\(h\.createdAt\);/);
  assert.doesNotMatch(list, /DEFAULT_TAGS\.filter\(\(tg\) => hands\.some/);
});

test('Exportar: «A preparar…» shows before the file is made, and a second tap waits', () => {
  const exp = read('app/export.tsx');
  assert.match(exp, /if \(busy\) return;/);
  assert.match(exp, /setBusy\(key\);\s*try \{\s*\/\/[^\n]*\n\s*await paint\(\);\s*await fn\(\);/);
  for (const k of ['sessions', 'hands', 'json']) assert.match(exp, new RegExp(`busy === '${k}' \\? t\\('A preparar…'\\)`));
});

test('no Math.min / Math.max spread over every hand left in the launch path', () => {
  for (const f of ['lib/welcome-back.ts', 'components/StartChecklist.tsx', 'billing/cancel.ts', 'store/streak.ts']) {
    assert.doesNotMatch(read(f), /Math\.(min|max)\([^)]*\.\.\.(hands|activity)/, f);
  }
});
