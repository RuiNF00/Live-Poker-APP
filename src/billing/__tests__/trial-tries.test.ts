import assert from 'node:assert/strict';
import test from 'node:test';

import { DATA_SESSIONS, forTrial, showTries, triesFor } from '../trial-tries';

const none = { sessions: 0, mtt: 0, currencies: 1, backers: 0 };

test('a new cash player gets what works from zero', () => {
  assert.deepEqual(triesFor({ goals: ['discuss'], plays: 'cash1', volume: 'few' }, none), ['voiceHand', 'hands']);
  assert.deepEqual(triesFor(null, none), ['voiceHand', 'hands']);
});

test('backers and tournaments come first, insights only with enough sessions', () => {
  assert.deepEqual(triesFor({ goals: ['backers'], plays: 'mtt3', volume: 'lots' }, none), ['staking', 'mttStats', 'voiceHand']);
  assert.deepEqual(triesFor({ goals: ['results'], plays: 'cash2', volume: 'some' }, { ...none, sessions: DATA_SESSIONS - 1 }), ['voiceHand', 'hands']);
  assert.deepEqual(triesFor({ goals: ['results'], plays: 'cash2', volume: 'some' }, { ...none, sessions: DATA_SESSIONS }), ['insights', 'voiceHand', 'varianceMine']);
  assert.deepEqual(triesFor(null, { sessions: 3, mtt: 2, currencies: 2, backers: 1 }), ['staking', 'mttStats', 'homeTotal']);
});

test('what was tried carries over only inside the same trial', () => {
  assert.deepEqual(forTrial({ start: 1, done: ['staking'] }, 1).done, ['staking']);
  assert.deepEqual(forTrial({ start: 1, done: ['staking'] }, 2), { start: 2, done: [] });
  assert.deepEqual(forTrial(null, 5), { start: 5, done: [] });
});

test('the card shows during the trial, until hidden or everything was opened', () => {
  const trial = { start: 100, end: 1000 };
  const keys = ['voiceHand', 'hands'] as const;
  assert.equal(showTries(trial, { start: 100, done: [] }, [...keys], null, 500), true);
  assert.equal(showTries(trial, { start: 100, done: [] }, [...keys], null, 1000), false);
  assert.equal(showTries(null, { start: 100, done: [] }, [...keys], null, 500), false);
  assert.equal(showTries(trial, { start: 100, done: [] }, [...keys], 100, 500), false);
  assert.equal(showTries(trial, { start: 100, done: [] }, [...keys], 42, 500), true);
  assert.equal(showTries(trial, { start: 100, done: ['voiceHand', 'hands'] }, [...keys], null, 500), false);
});
