/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CANCEL_REASONS, cancelReasons, logged } from '../cancel';
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
