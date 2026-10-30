/// <reference types="node" />
// «Apagar tudo», then the .json from before it restored: the links the erase deleted
// must not come back as «Partilhada»; links the server still has stay.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { goneShares, linksToCheck, unshared } from '../gone-shares';

const hands = [
  { id: 'h1', shareId: 'live1' },
  { id: 'h2', shareId: 'deleted2' },
  { id: 'h3', shareId: 'waiting3' },
  { id: 'h4', shareId: 'offline4' },
  { id: 'h5' },
];

test('a link the server lost, or whose delete still waits in the outbox, is gone; the rest stay', async () => {
  const asked: string[] = [];
  const gone = await goneShares(hands, {
    deleteWaiting: async (id) => id === 'waiting3',
    status: async (id) => {
      asked.push(id);
      if (id === 'offline4') throw new Error('network');
      return id === 'deleted2' ? 404 : 200;
    },
  });
  assert.deepEqual([...gone], [['h2', 'deleted2'], ['h3', 'waiting3']]);
  // A delete still queued needs no request.
  assert.ok(!asked.includes('waiting3'));
});

test('a link taken down by reports (410) is gone too; a busy server is not an answer', async () => {
  const gone = await goneShares([{ id: 'a', shareId: 'x' }, { id: 'b', shareId: 'y' }], { deleteWaiting: async () => false, status: async (id) => (id === 'x' ? 410 : 503) });
  assert.deepEqual([...gone.keys()], ['a']);
});

test('unshared drops the link and its token, keeps the hand, and is the newer copy', () => {
  const h = { id: 'h2', shareId: 's', shareToken: 't', notes: 'nota', updatedAt: 5 };
  const out = unshared(h, 9);
  assert.deepEqual(out, { id: 'h2', notes: 'nota', updatedAt: 9 });
});

test('own links: each checked at most once a day, newest first, a few per visit', async () => {
  const day = 24 * 3600 * 1000;
  const hands = Array.from({ length: 30 }, (_, i) => ({ id: 'h' + i, shareId: i === 3 ? undefined : 's' + i, createdAt: i }));
  const checked = new Map<string, number>();
  const first = linksToCheck(hands, checked, 10 * day);
  assert.equal(first.length, 20);
  assert.equal(first[0].id, 'h29', 'newest first');
  assert.ok(!first.some((h) => !h.shareId), 'a hand with no link is never checked');
  // An hour later: only the ones not checked yet.
  const next = linksToCheck(hands, checked, 10 * day + 3600 * 1000);
  assert.equal(next.length, 9);
  assert.equal(linksToCheck(hands, checked, 10 * day + 7200 * 1000).length, 0);
  // A day on, they're due again.
  assert.equal(linksToCheck(hands, checked, 11 * day).length, 20);
  // A link the server deleted is found; one it still has, or that couldn't be checked, stays.
  const gone = await goneShares(first.slice(0, 3), { deleteWaiting: async () => false, status: async (id) => (id === 's29' ? 404 : id === 's28' ? 200 : Promise.reject(new Error('offline'))) });
  assert.deepEqual([...gone], [['h29', 's29']]);
});
