/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buyError, playSubscriptionId, restoreFound } from '../buy-result';

test('a purchase closed in the store sheet is cancelled, not an error', () => {
  assert.equal(buyError({ userCancelled: true, code: '1' }), 'cancelled');
});

test('Ask to Buy or a card still being checked is pending, never "nothing was charged"', () => {
  assert.equal(buyError({ userCancelled: false, code: '20' }), 'pending');
});

test('a dropped line, a second tap, blocked purchases and an owned product each get their own answer', () => {
  assert.equal(buyError({ code: '10' }), 'network');
  assert.equal(buyError({ code: '35' }), 'network');
  assert.equal(buyError({ code: '15' }), 'busy');
  assert.equal(buyError({ code: '3' }), 'blocked');
  assert.equal(buyError({ code: '6' }), 'owned');
  assert.equal(buyError({ code: '7' }), 'owned');
});

test('anything else is an error', () => {
  assert.equal(buyError({ code: '2' }), 'error');
  assert.equal(buyError(new Error('network')), 'error');
  assert.equal(buyError(null), 'error');
});

test('a Play plan change names the old subscription without its base plan', () => {
  assert.equal(playSubscriptionId('sweatbook_pro_monthly:monthly'), 'sweatbook_pro_monthly');
  assert.equal(playSubscriptionId('sweatbook_pro_monthly'), 'sweatbook_pro_monthly');
});

test('a restore finds Pro by the entitlement: the one-time Pro is lifetime, not "no subscription"', () => {
  const info = (e?: { productIdentifier: string; expirationDate: string | null }) => ({ entitlements: { active: e ? { pro: e } : {} } });
  assert.equal(restoreFound(info({ productIdentifier: 'sweatbook_lifetime', expirationDate: null }), 'pro', 'sweatbook_lifetime'), 'lifetime');
  // Granted for good under another product id: still no end date, still lifetime.
  assert.equal(restoreFound(info({ productIdentifier: 'other_once', expirationDate: null }), 'pro', 'sweatbook_lifetime'), 'lifetime');
  assert.equal(restoreFound(info({ productIdentifier: 'sweatbook_annual', expirationDate: '2027-10-18T00:00:00Z' }), 'pro', 'sweatbook_lifetime'), 'ok');
  assert.equal(restoreFound(info(), 'pro', 'sweatbook_lifetime'), 'none');
});
