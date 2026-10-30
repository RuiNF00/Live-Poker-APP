/// <reference types="node" />
// The voice's plan lives in one place, so moving it to Plus is one line (Rui's list, 26 Oct).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLUS_ON, tierFor } from '../plans';
import { playerPlan, VOICE_PLAN, voiceLocked, voicePlanName } from '../voice-access';

test('the voice needs the plan plans.ts gives it, and the lock names it (Pro while Plus is off)', () => {
  assert.equal(VOICE_PLAN, tierFor('voiceHand'));
  assert.equal(VOICE_PLAN, PLUS_ON ? 'plus' : 'pro');
  assert.equal(voiceLocked({ isPro: true }), false);
  assert.equal(voiceLocked({ isPro: false }), true);
  assert.equal(voicePlanName(), PLUS_ON ? 'Plus' : 'Pro');
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
