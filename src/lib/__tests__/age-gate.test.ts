// The US age-range check: who is asked, what opens the app, and what stays on the phone.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adultRecord, adultStillConfirmed, AGE_KEY, opens, RECHECK_MS, shouldAsk, verdictOf } from '../age-gate-core';
import { keysToErase } from '../erase-core';

test('age check: asked only where Apple says the law applies, or when Apple could not answer', () => {
  assert.equal(shouldAsk(false), false);
  // Below iOS 26.2 Apple can't tell: asking would ask everyone, everywhere.
  assert.equal(shouldAsk(null), false);
  assert.equal(shouldAsk(true), true);
  assert.equal(shouldAsk('error'), true);
});

test('age check: only a lower bound of 18 or more opens the app', () => {
  assert.equal(verdictOf({ lowerBound: 18, upperBound: null }), 'adult');
  assert.equal(verdictOf({ lowerBound: 21, upperBound: null }), 'adult');
  assert.equal(verdictOf({ lowerBound: 13, upperBound: 17 }), 'minor');
  assert.equal(verdictOf({ lowerBound: null, upperBound: 17 }), 'minor');
  assert.equal(verdictOf({ lowerBound: null, upperBound: null }), 'unavailable');
  assert.equal(verdictOf({ code: 'ERR_AGE_RANGE_USER_DECLINED' }), 'declined');
  assert.equal(verdictOf({ code: 'ERR_AGE_RANGE_NOT_AVAILABLE' }), 'unavailable');
  assert.equal(verdictOf({ code: 'ERR_TIMEOUT' }), 'unavailable');
  assert.deepEqual((['adult', 'not-required', 'minor', 'declined', 'unavailable'] as const).filter(opens), ['adult', 'not-required']);
});

test('age check: the phone keeps only "adult" and the day, for a year', () => {
  const raw = adultRecord(1000);
  assert.deepEqual(JSON.parse(raw), { adult: true, at: 1000 });
  assert.equal(adultStillConfirmed(raw, 1000 + RECHECK_MS - 1), true);
  assert.equal(adultStillConfirmed(raw, 1000 + RECHECK_MS), false);
  assert.equal(adultStillConfirmed(raw, 999), false);
  assert.equal(adultStillConfirmed(null), false);
  assert.equal(adultStillConfirmed('{"adult":false,"at":1}', 2), false);
  assert.equal(adultStillConfirmed('not json'), false);
});

test('age check: «Apagar todos os dados» removes the flag', () => {
  assert.deepEqual(keysToErase([AGE_KEY]), [AGE_KEY]);
});

test('age check: the entitlement plugin adds Declared Age Range and keeps the rest', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { addAgeRange } = require('../../../plugins/with-declared-age-range') as { addAgeRange: (e: Record<string, unknown>) => Record<string, unknown> };
  assert.deepEqual(addAgeRange({ 'aps-environment': 'production' }), { 'aps-environment': 'production', 'com.apple.developer.declared-age-range': true });
});
