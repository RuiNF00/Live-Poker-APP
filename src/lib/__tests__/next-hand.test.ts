/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextHandAfterSave } from '../next-hand';

test('a new hand of the live session goes on to the next hand', () => {
  assert.equal(nextHandAfterSave({ asNew: true, isEdit: false, hand: { sessionId: 's1' }, liveSessionId: 's1' }), true);
});

test('an edit, a hand saved again, no live session or another session open the hand page', () => {
  assert.equal(nextHandAfterSave({ asNew: true, isEdit: true, hand: { sessionId: 's1' }, liveSessionId: 's1' }), false);
  assert.equal(nextHandAfterSave({ asNew: false, isEdit: false, hand: { sessionId: 's1' }, liveSessionId: 's1' }), false);
  assert.equal(nextHandAfterSave({ asNew: true, isEdit: false, hand: { sessionId: 's1' }, liveSessionId: null }), false);
  assert.equal(nextHandAfterSave({ asNew: true, isEdit: false, hand: { sessionId: undefined }, liveSessionId: 's1' }), false);
  assert.equal(nextHandAfterSave({ asNew: true, isEdit: false, hand: { sessionId: 's0' }, liveSessionId: 's1' }), false);
});
