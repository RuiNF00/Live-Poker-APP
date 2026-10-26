/// <reference types="node" />
// The voice's plan lives in one place, so moving it to Plus is one line (Rui's list, 26 Oct).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PRO_ONLY } from '../plans';
import { playerPlan, VOICE_PLAN, voiceLocked, voicePlanName } from '../voice-access';

test('today the voice is Pro, as PRO_ONLY says: nothing changes for anyone', () => {
  assert.equal(VOICE_PLAN, PRO_ONLY.voiceHand ? 'pro' : 'free');
  assert.equal(voiceLocked({ isPro: true }), false);
  assert.equal(voiceLocked({ isPro: false }), PRO_ONLY.voiceHand);
  assert.equal(voicePlanName(), 'Pro');
});

test('with Plus: Plus and Pro both have the voice, free does not', () => {
  assert.equal(voiceLocked({ isPro: false, isPlus: true }, 'plus'), false);
  assert.equal(voiceLocked({ isPro: true }, 'plus'), false);
  assert.equal(voiceLocked({ isPro: false }, 'plus'), true);
  // Something kept for Pro stays locked on Plus.
  assert.equal(voiceLocked({ isPro: false, isPlus: true }, 'pro'), true);
  assert.equal(voicePlanName('plus'), 'Plus');
  assert.equal(playerPlan({ isPro: true, isPlus: true }), 'pro');
});

test('the entitlement hook decides once it can answer for voiceHand', () => {
  assert.equal(voiceLocked({ isPro: false, can: () => true }), false);
  assert.equal(voiceLocked({ isPro: true, can: () => false }), true);
});
