import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_FRIEND_HANDS, parseFriendHands, parseSeen, remember, total, unseen } from '../friend-hands-core';

test('a hand opened again moves to the top, once', () => {
  const a = remember([], { id: 'aaaa1', title: 'AKs' }, 1);
  const b = remember(a, { id: 'bbbb2', title: 'QQ' }, 2);
  const c = remember(b, { id: 'aaaa1', title: 'AKs vs JJ' }, 3);
  assert.deepEqual(c.map((h) => [h.id, h.title]), [['aaaa1', 'AKs vs JJ'], ['bbbb2', 'QQ']]);
});

test('keeps at most the cap', () => {
  let list = parseFriendHands([]);
  for (let i = 0; i < MAX_FRIEND_HANDS + 5; i++) list = remember(list, { id: `hand${i}`, title: '' }, i);
  assert.equal(list.length, MAX_FRIEND_HANDS);
  assert.equal(list[0].id, `hand${MAX_FRIEND_HANDS + 4}`);
});

test('reads back only what is valid', () => {
  assert.deepEqual(parseFriendHands([{ id: 'ok123', title: 'x', openedAt: 5 }, { id: '../x', title: 'y', openedAt: 1 }, null, 'z']), [{ id: 'ok123', title: 'x', openedAt: 5 }]);
  assert.deepEqual(parseSeen({ ok123: 2, bad: -1, '../x': 3, other: 'a' }), { ok123: 2 });
  assert.deepEqual(parseFriendHands('nope'), []);
});

test('new comments are the count less what was seen', () => {
  const u = unseen({ aaaa1: 5, bbbb2: 2, cccc3: 1 }, { aaaa1: 3, bbbb2: 2 });
  assert.deepEqual(u, { aaaa1: 2, cccc3: 1 });
  assert.equal(total(u), 3);
  // A comment hidden by the owner lowers the count: never negative.
  assert.deepEqual(unseen({ aaaa1: 1 }, { aaaa1: 3 }), {});
});
