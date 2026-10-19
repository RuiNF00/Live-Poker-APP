// The US age-range check: who is asked and what opens the app. Nothing of the answer is stored.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OLD_AGE_KEY, opens, shouldAsk, verdictOf } from '../age-gate-core';
import { keysToErase } from '../erase-core';

test('age check: asked only where Apple says the law applies', () => {
  assert.equal(shouldAsk(false), false);
  // Below iOS 26.2 Apple can't tell: asking would ask everyone, everywhere.
  assert.equal(shouldAsk(null), false);
  // No answer or an error: nobody outside the law is asked; the next launch asks Apple again.
  assert.equal(shouldAsk('error'), false);
  assert.equal(shouldAsk(true), true);
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

test('age check: the old prototype flag is an app key, so «Apagar todos os dados» removes it too', () => {
  assert.deepEqual(keysToErase([OLD_AGE_KEY]), [OLD_AGE_KEY]);
});

test('age check: the entitlement plugin adds Declared Age Range and keeps the rest', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { addAgeRange } = require('../../../plugins/with-declared-age-range') as { addAgeRange: (e: Record<string, unknown>) => Record<string, unknown> };
  assert.deepEqual(addAgeRange({ 'aps-environment': 'production' }), { 'aps-environment': 'production', 'com.apple.developer.declared-age-range': true });
});
