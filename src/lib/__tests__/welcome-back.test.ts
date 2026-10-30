/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lastActivity, welcomeBackDue } from '../welcome-back';

const DAY = 86_400_000;

test('welcome back after 30 days without logging, once per pause', () => {
  const now = 100 * DAY;
  assert.equal(lastActivity([{ startedAt: 10 * DAY }], [{ createdAt: 60 * DAY }]), 60 * DAY);
  assert.equal(lastActivity([], []), 0);
  assert.equal(welcomeBackDue(0, now, null), false, 'nothing logged yet: the first run, not a return');
  assert.equal(welcomeBackDue(now - 29 * DAY, now, null), false);
  assert.equal(welcomeBackDue(now - 30 * DAY, now, null), true);
  assert.equal(welcomeBackDue(now - 30 * DAY, now, now - 30 * DAY), false, 'already greeted for this pause');
  assert.equal(welcomeBackDue(now - 40 * DAY, now, now - 90 * DAY), true, 'a new pause greets again');
});
