/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CANCEL_REASONS, cancelReasons, logged, scrubNote } from '../cancel';
import type { Session } from '@/store/types';

const s = (startedAt: number, buyIn: number, cashOut: number) =>
  ({ id: String(startedAt), kind: 'cash', currency: '€', startedAt, endedAt: startedAt + 3_600_000, breaks: [], buyIn, entries: 1, addOn: 0, cashOut }) as unknown as Session;

test('nothing logged: nothing to show', () => {
  assert.equal(logged([], []), null);
});

test('counts, net result and the earliest date', () => {
  const l = logged([{ createdAt: 500 }, { createdAt: 2_000 }], [s(1_000, 200, 500), s(3_000, 300, 0)]);
  assert.deepEqual(l, { sessions: 2, hands: 2, profit: 0, currency: '€', since: 500 });
});

test('the session count matches the amount: finished sessions in the main currency only', () => {
  const usd = { ...s(4_000, 1_000, 0), currency: '$' } as Session;
  const live = { ...s(5_000, 100, 0), endedAt: undefined } as Session;
  const l = logged([], [s(1_000, 200, 500), s(3_000, 300, 180), usd, live]);
  assert.equal(l?.sessions, 2);
  assert.equal(l?.profit, 180);
  assert.equal(l?.currency, '€');
  // Only a session still running: nothing to show yet.
  assert.equal(logged([], [live]), null);
});

test('one reason each, no "Outro"', () => {
  assert.equal(CANCEL_REASONS.length, 5);
  assert.ok(!CANCEL_REASONS.some((r) => /outro/i.test(r.label)));
});

test('"Não quero uma subscrição" only with a one-time Pro to offer', () => {
  assert.deepEqual(cancelReasons(false), CANCEL_REASONS);
  const on = cancelReasons(true);
  assert.equal(on.length, 6);
  assert.equal(on[2].key, 'noSubscription');
});

test('scrubNote drops emails, phone numbers and links', () => {
  assert.equal(scrubNote('caro demais, fala comigo rui@exemplo.pt ou +351 912 345 678'), 'caro demais, fala comigo … ou …');
  assert.equal(scrubNote('vejam www.exemplo.com'), 'vejam …');
});

test('scrubNote keeps stakes and short numbers', () => {
  assert.equal(scrubNote('só jogo 1/2 e 2/5, não preciso'), 'só jogo 1/2 e 2/5, não preciso');
});
