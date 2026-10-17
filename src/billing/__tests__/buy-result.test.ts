/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buyError, playSubscriptionId } from '../buy-result';

test('a purchase closed in the store sheet is cancelled, not an error', () => {
  assert.equal(buyError({ userCancelled: true, code: '1' }), 'cancelled');
});

test('Ask to Buy or a card still being checked is pending, never "nothing was charged"', () => {
  assert.equal(buyError({ userCancelled: false, code: '20' }), 'pending');
});

test('anything else is an error', () => {
  assert.equal(buyError({ code: '10' }), 'error');
  assert.equal(buyError(new Error('network')), 'error');
  assert.equal(buyError(null), 'error');
});

test('a Play plan change names the old subscription without its base plan', () => {
  assert.equal(playSubscriptionId('sweatbook_pro_monthly:monthly'), 'sweatbook_pro_monthly');
  assert.equal(playSubscriptionId('sweatbook_pro_monthly'), 'sweatbook_pro_monthly');
});
