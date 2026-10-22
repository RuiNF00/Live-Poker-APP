/// <reference types="node" />
// «Treino com as tuas mãos» (before/after list, item 6): answer before you see, then again in 3 days and a week.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeStreak, streakActivity } from '../../store/streak';
import { answered, drillQueue, DRILL_GAPS, isDue, type DrillState } from '../drill';
import { sampleHand } from '../sample';
import type { Hand } from '../types';

const DAY = 86_400_000;
const now = new Date(2026, 9, 22, 12).getTime();
const mk = (id: string, over: Partial<Hand> = {}): Hand => ({ ...sampleHand(id), createdAt: now - 10 * DAY, tags: [], ...over });

test('answering plans the hand again in 3 days, then a week, then it is done', () => {
  let s: DrillState = {};
  s = answered(s, 'a', now);
  assert.deepEqual(s.a, { due: now + DRILL_GAPS[0], done: 1 });
  assert.equal(DRILL_GAPS[0], 3 * DAY);
  s = answered(s, 'a', now + 3 * DAY);
  assert.deepEqual(s.a, { due: now + 3 * DAY + 7 * DAY, done: 2 });
  s = answered(s, 'a', now + 10 * DAY);
  assert.equal(s.a, undefined);
});

test('a hand asks when it waits for review or is due again, not before', () => {
  const pending = mk('p', { review: 'pending' });
  const reviewed = mk('r', { review: 'reviewed', reviewedAt: now - DAY });
  assert.ok(isDue(pending, {}, now));
  assert.ok(!isDue(reviewed, {}, now), 'reviewed before the training existed: not asked again');
  assert.ok(!isDue(reviewed, { r: { due: now + DAY, done: 1 } }, now));
  assert.ok(isDue(reviewed, { r: { due: now - 1, done: 1 } }, now));
  assert.ok(!isDue(mk('x'), {}, now), 'an unmarked hand is never a question');
});

test('«Treino da semana»: due again first, then marked ones oldest first, at most 3', () => {
  const hands = [
    mk('new1', { review: 'pending', createdAt: now - 2 * DAY }),
    mk('new2', { tags: ['Rever'], createdAt: now - 5 * DAY }),
    mk('again1', { review: 'reviewed' }),
    mk('again2', { review: 'reviewed' }),
    mk('later', { review: 'reviewed' }),
  ];
  const s: DrillState = { again1: { due: now - DAY, done: 1 }, again2: { due: now - 3 * DAY, done: 2 }, later: { due: now + DAY, done: 1 } };
  assert.deepEqual(drillQueue(hands, s, now).map((h) => h.id), ['again2', 'again1', 'new2']);
  assert.equal(drillQueue(hands, s, now, Infinity).length, 4);
  assert.equal(drillQueue(hands, s, now + 2 * DAY, Infinity).length, 5, 'by Sunday the later one is due too');
});

test('a week with only a review still counts for the streak', () => {
  const lastWeek = now - 7 * DAY;
  const hands = [{ createdAt: lastWeek - 7 * DAY, reviewedAt: now - 3_600_000 }, { createdAt: lastWeek }];
  const s = computeStreak(streakActivity(hands, [], []), [], now);
  assert.equal(s.weeks, 3);
});
