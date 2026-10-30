/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summaryPrompts } from '../summary-prompts';

test('summary shows at most two prompts, the urgent ones first', () => {
  assert.deepEqual([...summaryPrompts({ review: true, unfinished: true, pro: true, nextPlay: true })], ['review', 'unfinished']);
  assert.deepEqual([...summaryPrompts({ unfinished: true, pro: true, nextPlay: true })], ['unfinished', 'pro']);
  assert.deepEqual([...summaryPrompts({ review: true, nextPlay: true })], ['review', 'nextPlay']);
  assert.deepEqual([...summaryPrompts({ pro: true, nextPlay: true })], ['pro', 'nextPlay']);
  assert.deepEqual([...summaryPrompts({})], []);
});
