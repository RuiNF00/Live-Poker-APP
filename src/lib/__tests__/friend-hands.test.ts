import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handLoadError, MAX_FRIEND_HANDS, newsTarget, parseFriendHands, parseSeen, remember, streetOfNew, total, unseen } from '../friend-hands-core';

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

test('keeps the hole cards only when they are two real cards', () => {
  assert.deepEqual(remember([], { id: 'abcd1', title: 'AK', cards: ['As', 'Kd'] }, 1)[0].cards, ['As', 'Kd']);
  assert.equal(remember([], { id: 'abcd1', title: 'AK', cards: ['As', 'Xx'] }, 1)[0].cards, undefined);
  assert.equal(parseFriendHands([{ id: 'abcd1', title: '', openedAt: 1, cards: ['As'] }])[0].cards, undefined);
});


test('opens on the street of the newest new comment', () => {
  const c = [
    { street: 'flop' as const, createdAt: 1 },
    { street: 'river' as const, createdAt: 3 },
    { street: null, createdAt: 4 },
    { street: 'turn' as const, createdAt: 2 },
  ];
  assert.equal(streetOfNew(c, 2), 'river');
  assert.equal(streetOfNew(c, 1), null);
  assert.equal(streetOfNew(c, 0), null);
});

test('the home card goes straight to the one hand with news', () => {
  const mine = [{ id: 'local1', shareId: 'abcd1' }];
  assert.deepEqual(newsTarget({ abcd1: 2 }, mine), { kind: 'mine', id: 'local1', n: 2 });
  assert.deepEqual(newsTarget({ zzzz9: 1 }, mine), { kind: 'friend', id: 'zzzz9', n: 1 });
  assert.equal(newsTarget({ abcd1: 1, zzzz9: 1 }, mine), null);
});

test('a shared hand is "gone" only when the server says so; no signal is not a deleted hand', () => {
  assert.equal(handLoadError(new Error('fetch 404')), 'gone');
  assert.equal(handLoadError(new Error('fetch 410')), 'gone');
  assert.equal(handLoadError(new Error('fetch 500')), 'offline');
  assert.equal(handLoadError(new TypeError('Network request failed')), 'offline');
  assert.equal(handLoadError(new Error('Aborted')), 'offline');
  assert.equal(handLoadError(undefined), 'offline');
});
