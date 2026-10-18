/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseBackup } from '../backup';
import { alive, cleanDeleted, joinDeleted } from '../deleted-math';

test('deletes: the later time of each wins, and only what was not edited after goes', () => {
  const d = joinDeleted({ 'sessions:a': 10, 'hands:x': 5 }, { 'sessions:a': 30 });
  assert.deepEqual(d, { 'sessions:a': 30, 'hands:x': 5 });
  const list = [{ id: 'a', updatedAt: 20 }, { id: 'b', updatedAt: 1 }];
  assert.deepEqual(alive(list, 'sessions', d).map((x) => x.id), ['b']);
  assert.deepEqual(alive([{ id: 'a', updatedAt: 40 }], 'sessions', d).map((x) => x.id), ['a']);
  // Another list's delete doesn't touch an item with the same id.
  assert.equal(alive(list, 'players', d), list);
  // An item with no edit time (older data) counts as before the delete.
  assert.deepEqual(alive([{ id: 'x' }], 'hands', d), []);
});

test('deletes from a file: only well-formed keys with a real time', () => {
  assert.deepEqual(cleanDeleted({ 'sessions:a': 3, 'quarantine:x': 4, 'hands:b': -1, 'hands:c': 'x', 'trips:': 2, 'hands:\nz': 1 }), { 'sessions:a': 3 });
  assert.deepEqual(cleanDeleted([1, 2]), {});
  const b = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, exportedAt: 1, hands: [], sessions: [], players: [], deleted: { 'sessions:a': 3, bad: 1 } }));
  assert.deepEqual(b.deleted, { 'sessions:a': 3 });
  // A copy made before deletes were kept reads as none.
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, exportedAt: 1, hands: [], sessions: [], players: [] })).deleted, {});
});

test('deletes: the newest 5000 are kept', () => {
  const many = Object.fromEntries(Array.from({ length: 5100 }, (_, i) => [`hands:h${i}`, i + 1]));
  const d = cleanDeleted(many);
  assert.equal(Object.keys(d).length, 5000);
  assert.equal(d['hands:h0'], undefined);
  assert.equal(d['hands:h5099'], 5100);
});
