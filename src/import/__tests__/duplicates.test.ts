/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../../store/types';
import { likelyDuplicates } from '../duplicates';

const at = (d: string) => new Date(d).getTime();
const s = (id: string, start: string, buyIn: number, cashOut: number, more: Partial<Session> = {}): Session =>
  ({ id, kind: 'cash', name: 'Cash', venue: '', currency: '€', startedAt: at(start), breaks: [], buyIn, entries: 1, addOn: 0, cashOut, ...more }) as Session;

test('the same night from another app is flagged, whatever the venue or start hour says', () => {
  const have = [s('a', '2025-02-03T21:00', 200, 450, { venue: 'Casino Estoril' })];
  const file = [s('imp_1', '2025-02-03T18:00', 200, 450, { venue: 'Estoril' }), s('imp_2', '2025-02-04T18:00', 200, 450)];
  assert.deepEqual([...likelyDuplicates(file, have)], ['imp_1']);
});

test('a different result, kind or currency is not a duplicate', () => {
  const have = [s('a', '2025-02-03T21:00', 200, 450)];
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 200, 451)], have).size, 0);
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 200, 450, { kind: 'mtt' })], have).size, 0);
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 200, 450, { currency: '$' })], have).size, 0);
});

test('one existing session pairs with one imported row: two equal rows leave one to import', () => {
  const have = [s('a', '2025-02-03T21:00', 100, 100)];
  const file = [s('x', '2025-02-03T20:00', 100, 100), s('y', '2025-02-03T20:00', 100, 100)];
  assert.equal(likelyDuplicates(file, have).size, 1);
});

test('a session past midnight still matches within six hours, and ids already here are left to the merge', () => {
  const have = [s('a', '2025-02-03T23:30', 100, 300)];
  assert.equal(likelyDuplicates([s('x', '2025-02-04T01:00', 100, 300)], have).size, 1);
  assert.equal(likelyDuplicates([s('a', '2025-02-03T23:30', 100, 300)], have).size, 0);
});

test('a result the other app kept expenses out of still matches the table result', () => {
  const have = [s('a', '2025-02-03T21:00', 200, 450, { expenses: 30 })];
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 200, 450)], have).size, 1);
});
