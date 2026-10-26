/// <reference types="node" />
// The hand screen maps over the comments: anything but a list from the server must give [].
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { commentsFrom } from '../comments-list';

const c = { id: 'c1', name: 'Ana', text: 'Fold', createdAt: 1 };

test('the server answer, old and new shape, gives the list', () => {
  assert.deepEqual(commentsFrom({ comments: [c] }), [c]);
  assert.deepEqual(commentsFrom([c]), [c]);
});

test('a 200 that is not the list (a proxy, a portal) gives no comments instead of a crash', () => {
  for (const body of [{}, null, 'ok', 42, { comments: null }, { comments: {} }]) assert.deepEqual(commentsFrom(body), []);
  assert.deepEqual(commentsFrom({ comments: [c, null, { id: 2 }, 'x'] }), [c], 'broken items dropped');
});
