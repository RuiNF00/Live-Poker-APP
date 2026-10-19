import assert from 'node:assert/strict';
import { test } from 'node:test';

import { becameAllowed, holdNow, kindOn, outOfQuiet, pickDaily, SOFT_ASK_COOLDOWN, softAskAllowed } from '../notify-policy';

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
