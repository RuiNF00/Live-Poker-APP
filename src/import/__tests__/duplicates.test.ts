/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../../store/types';
import { likelyDuplicateMoves, likelyDuplicates } from '../duplicates';

const at = (d: string) => new Date(d).getTime();
const s = (id: string, start: string, buyIn: number, cashOut: number, more: Partial<Session> = {}): Session =>
  ({ id, kind: 'cash', name: 'Cash', venue: '', currency: '€', startedAt: at(start), breaks: [], buyIn, entries: 1, addOn: 0, cashOut, ...more }) as Session;

test('the same night from another app is flagged, whatever the venue or start hour says', () => {
  const have = [s('a', '2025-02-03T21:00', 200, 450, { venue: 'Casino Estoril' })];
  const file = [s('imp_1', '2025-02-03T18:00', 200, 450, { venue: 'Estoril' }), s('imp_2', '2025-02-04T18:00', 200, 450)];
  assert.deepEqual([...likelyDuplicates(file, have)].map(([id, e]) => [id, e.id]), [['imp_1', 'a']]);
});

test('a different result, kind or currency is not a duplicate', () => {
  const have = [s('a', '2025-02-03T21:00', 200, 450)];
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 200, 455)], have).size, 0);
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 200, 450, { kind: 'mtt' })], have).size, 0);
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 200, 450, { currency: '$' })], have).size, 0);
});

test('one existing session pairs with one imported row: two equal rows leave one to import', () => {
  const have = [s('a', '2025-02-03T21:00', 100, 100)];
  const file = [s('x', '2025-02-03T20:00', 100, 100), s('y', '2025-02-03T20:00', 100, 100)];
  assert.equal(likelyDuplicates(file, have).size, 1);
});

test('a session past midnight still matches within three hours, and ids already here are left to the merge', () => {
  const have = [s('a', '2025-02-03T23:30', 100, 300)];
  assert.equal(likelyDuplicates([s('x', '2025-02-04T01:00', 100, 300)], have).size, 1);
  assert.equal(likelyDuplicates([s('x', '2025-02-04T03:00', 100, 300)], have).size, 0);
  assert.equal(likelyDuplicates([s('a', '2025-02-03T23:30', 100, 300)], have).size, 0);
});

test('a staked session with expenses still matches on the whole action', () => {
  const have = [s('a', '2025-02-03T21:00', 200, 450, { expenses: 30, tips: 10, staking: { sold: 50, markup: 1 } })];
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 200, 450)], have).size, 1);
});

test('an app that rounds to whole units still matches; two decimals that differ do not', () => {
  const have = [s('a', '2025-02-03T21:00', 100, 250.6)];
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 100, 251)], have).size, 1);
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 100, 250.4)], have).size, 0);
  // 150.30 - 50.30 is not exactly 100 in floating point: still a whole 100, so 100.40 from a rounding app matches.
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 50.3, 150.7)], [s('a', '2025-02-03T21:00', 50.3, 150.3)]).size, 1);
  // Rounding never moves more than 0.50: 150.01 against 151 is another night.
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 100, 251)], [s('a', '2025-02-03T21:00', 100, 250.01)]).size, 0);
  // +100 and +101 on the same day are two different nights.
  assert.equal(likelyDuplicates([s('x', '2025-02-03T21:00', 100, 201)], [s('a', '2025-02-03T21:00', 100, 200)]).size, 0);
});

test('deposits and withdrawals: same bankroll currency, direction, amount and day', () => {
  const bankrolls = [{ id: 'b1', name: 'Main', currency: '€', createdAt: 0 }];
  const have = [{ id: 't1', bankrollId: 'b1', kind: 'deposit' as const, amount: 500, at: at('2025-02-03T10:00'), note: '' }];
  const move = (id: string, kind: 'deposit' | 'withdrawal', amount: number, currency = '€') => ({ id, kind, amount, at: at('2025-02-03T20:00'), currency, note: '' });
  assert.deepEqual([...likelyDuplicateMoves([move('m1', 'deposit', 500), move('m2', 'deposit', 500), move('m3', 'withdrawal', 500), move('m4', 'deposit', 500, '$')], have, bankrolls)], ['m1']);
});
