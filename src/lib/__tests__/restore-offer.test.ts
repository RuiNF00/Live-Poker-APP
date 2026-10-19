/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { offerStep, restoreOffer, welcomeStep } from '../restore-offer';

const base = { due: true, online: true, lockUp: false, welcomeUp: false };

test('reinstall with a copy: the offer is asked first, the welcome waits', () => {
  assert.equal(offerStep(base), 'ask');
  assert.equal(welcomeStep('due', false), 'wait');
  // Still waiting after the fallback timer: the offer is on screen.
  assert.equal(welcomeStep('due', true), 'wait');
});

test('accepted skips the welcome, declined opens it', () => {
  assert.equal(welcomeStep('accepted', false), 'skip');
  assert.equal(welcomeStep('accepted', true), 'skip');
  assert.equal(welcomeStep('declined', false), 'open');
});

test('nothing to offer: the welcome opens as on any first run', () => {
  assert.equal(offerStep({ ...base, due: false }), 'none');
  assert.equal(welcomeStep('none', false), 'open');
});

test('not checked yet: the welcome waits, then opens anyway', () => {
  assert.equal(welcomeStep('unknown', false), 'wait');
  assert.equal(welcomeStep('unknown', true), 'open');
});

test('the offer waits for the lock and never sits over the welcome', () => {
  assert.equal(offerStep({ ...base, lockUp: true }), 'wait');
  assert.equal(offerStep({ ...base, welcomeUp: true }), 'later');
  assert.equal(offerStep({ ...base, welcomeUp: true, lockUp: true }), 'later');
  // No signal: nothing to download, the welcome goes ahead.
  assert.equal(offerStep({ ...base, online: false }), 'later');
});

test('the answer stands for the rest of the launch', () => {
  const seen: string[] = [];
  const off = restoreOffer.subscribe(() => seen.push(restoreOffer.get()));
  restoreOffer.set('due');
  restoreOffer.set('due');
  restoreOffer.set('accepted');
  // A later check finds the offer already made (nothing due): the answer is kept.
  restoreOffer.set('none');
  off();
  assert.deepEqual(seen, ['due', 'accepted']);
  assert.equal(restoreOffer.get(), 'accepted');
});

test('a restore that fails after «Recuperar» opens the welcome after all', () => {
  // Same module state as above: accepted.
  assert.equal(restoreOffer.get(), 'accepted');
  restoreOffer.failed();
  assert.equal(restoreOffer.get(), 'declined');
  assert.equal(welcomeStep(restoreOffer.get(), false), 'open');
  // Only an accepted offer can fail.
  restoreOffer.failed();
  assert.equal(restoreOffer.get(), 'declined');
});
