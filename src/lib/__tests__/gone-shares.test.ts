/// <reference types="node" />
// «Apagar tudo», then the .json from before it restored: the links the erase deleted
// must not come back as «Partilhada»; links the server still has stay.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { goneShares, unshared } from '../gone-shares';

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
