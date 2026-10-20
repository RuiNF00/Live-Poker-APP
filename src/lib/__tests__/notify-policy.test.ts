import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  askOnSummary,
  becameAllowed,
  holdNow,
  kindInfo,
  kindOn,
  KINDS,
  outOfQuiet,
  pickDaily,
  SOFT_ASK_COOLDOWN,
  softAskAllowed,
  SUMMARY_ASK_WITHIN,
  SUMMARY_ASKS_MAX,
  SUMMARY_SECOND_ASK_FROM,
} from '../notify-policy';

const at = (h: number, m = 0, day = 17) => new Date(2026, 9, day, h, m).getTime();

test('quiet hours move unrequested notices to the next 12:00, requested ones keep their time', () => {
  assert.equal(outOfQuiet(at(10), 'recap'), at(12));
  assert.equal(outOfQuiet(at(23, 30), 'tips'), at(12, 0, 18));
  assert.equal(outOfQuiet(at(1), 'coach'), at(12));
  assert.equal(outOfQuiet(at(15), 'money'), at(15));
  assert.equal(outOfQuiet(at(3), 'levels'), at(3));
  assert.equal(outOfQuiet(at(3), 'festival'), at(3));
  assert.equal(outOfQuiet(at(9), 'billing'), at(9));
});

test('a live session holds what is not the session, unless paused or turned off', () => {
  const live = { paused: false };
  assert.equal(holdNow('money', live, {}), true);
  assert.equal(holdNow('coach', live, {}), true);
  assert.equal(holdNow('levels', live, {}), false);
  assert.equal(holdNow('festival', live, {}), false);
  assert.equal(holdNow('money', { paused: true }, {}), false);
  assert.equal(holdNow('money', null, {}), false);
  assert.equal(holdNow('money', live, { notifyHoldInSession: false }), false);
});

test('switches: on until turned off; the month recap keeps its own switch; billing has none', () => {
  assert.equal(kindOn({}, 'money'), true);
  assert.equal(kindOn({ notify: { money: false } }, 'money'), false);
  assert.equal(kindOn({ monthRecap: false }, 'recap'), false);
  assert.equal(kindOn({ notify: { billing: false } }, 'billing'), true);
});

test('one unrequested notice a day, the most important', () => {
  const out = pickDaily([
    { id: 'comeback', at: at(13) },
    { id: 'recap-2026-10', at: at(13, 5) },
    { id: 'trial-day5', at: at(13, 0, 18) },
  ]);
  assert.deepEqual(out.map((x) => x.id), ['recap-2026-10', 'trial-day5']);
});

test('"Agora não" waits 30 days', () => {
  const now = at(12);
  assert.equal(softAskAllowed(null, now), true);
  assert.equal(softAskAllowed(now - SOFT_ASK_COOLDOWN + 1, now), false);
  assert.equal(softAskAllowed(now - SOFT_ASK_COOLDOWN, now), true);
});

test('reminders are planned again only when notifications go from no to yes', () => {
  assert.equal(becameAllowed(false, true), true);
  assert.equal(becameAllowed(true, true), false);
  assert.equal(becameAllowed(null, true), false);
  assert.equal(becameAllowed(false, false), false);
  assert.equal(becameAllowed(true, false), false);
});

test('interruption: only what the player set a time for breaks through Focus', () => {
  assert.deepEqual(
    KINDS.filter((k) => k.interruption === 'timeSensitive').map((k) => k.kind),
    ['levels', 'festival'],
  );
  for (const k of KINDS) if (k.interruption === 'timeSensitive') assert.ok(k.requested, k.kind);
});

test('interruption: the Sunday week and the reminders arrive silently, nothing is critical', () => {
  assert.equal(kindInfo('week').interruption, 'passive');
  assert.equal(kindInfo('tips').interruption, 'passive');
  for (const k of KINDS) assert.ok(['timeSensitive', 'active', 'passive'].includes(k.interruption), k.kind);
});

const ended = Date.parse('2026-10-20T20:00:00Z');
const ask = { closed: 1, asks: 0, weekOn: true, endedAt: ended - 60_000, now: ended };

test('askOnSummary: right after the first saved session', () => {
  assert.equal(askOnSummary(ask), true);
  assert.equal(askOnSummary({ ...ask, closed: 0 }), false);
});

test('askOnSummary: not on a summary opened again later, nor with «A tua semana» off', () => {
  assert.equal(askOnSummary({ ...ask, endedAt: ended - SUMMARY_ASK_WITHIN - 1 }), false);
  assert.equal(askOnSummary({ ...ask, endedAt: undefined }), false);
  assert.equal(askOnSummary({ ...ask, weekOn: false }), false);
});

test('askOnSummary: a second time only from the third session, then never', () => {
  assert.equal(askOnSummary({ ...ask, asks: 1, closed: 2 }), false);
  assert.equal(askOnSummary({ ...ask, asks: 1, closed: SUMMARY_SECOND_ASK_FROM }), true);
  assert.equal(askOnSummary({ ...ask, asks: SUMMARY_ASKS_MAX, closed: 30 }), false);
});

test('«A tua semana» starts as «Lembretes» was, then has its own switch', () => {
  assert.equal(kindOn({}, 'week'), true);
  assert.equal(kindOn({ notify: { tips: false } }, 'week'), false);
  assert.equal(kindOn({ notify: { tips: false, week: true } }, 'week'), true);
  assert.equal(kindOn({ notify: { week: false } }, 'tips'), true);
});
