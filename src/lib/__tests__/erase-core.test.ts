/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { KEEP_KEYS, keysToErase } from '../erase-core';

test('erasing removes every hand, session, setting and cloud code, and keeps the pending deletes and the free-plan log', () => {
  const all = ['rl.hands.v2', 'rl.hand.v2.a', 'rl.session.v2.b', 'rl.settings.v1', 'rl.cloud.v1', 'rl.draft.v1', 'rl.festivalPlans.v1', 'sweatbook.replayer.tips.v1', ...KEEP_KEYS, 'expo.other'];
  const gone = keysToErase(all);
  assert.deepEqual(gone, ['rl.hands.v2', 'rl.hand.v2.a', 'rl.session.v2.b', 'rl.settings.v1', 'rl.cloud.v1', 'rl.draft.v1', 'rl.festivalPlans.v1', 'sweatbook.replayer.tips.v1']);
  for (const k of ['rl.outbox.v1', 'sweatbook.share-queue.v1', 'rl.usage.v1', 'rl.pro.v1']) assert.ok(!gone.includes(k), k);
  assert.ok(!gone.includes('expo.other'));
});
