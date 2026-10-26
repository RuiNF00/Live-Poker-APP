import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pageVersion } from '../backer-page-version';
import type { Backer, BackerPayment, Session, StakePackage } from '@/store/types';

const backer = { id: 'b1', name: 'Ana', note: '', createdAt: 10 } as Backer;
const session = (id: string, startedAt: number, updatedAt?: number) => ({ id, startedAt, updatedAt, stakes: [{ backerId: 'b1', share: 20, markup: 1 }] }) as unknown as Session;
const payment = (id: string, createdAt: number, updatedAt?: number) => ({ id, backerId: 'b1', amount: 50, at: createdAt, note: '', createdAt, updatedAt }) as BackerPayment;
const base = { backers: [backer], sessions: [session('s1', 100, 150)], packages: [] as StakePackage[], payments: [payment('p1', 120)], offers: [], deleted: {} };

test('the version is the newest change the phone knows (Swaps P3, 19 Oct)', () => {
  assert.equal(pageVersion(base), 150);
  // A phone that saw a later payment is newer than one that didn't.
  assert.equal(pageVersion({ ...base, payments: [payment('p1', 120), payment('p2', 300)] }), 300);
  // An edit to an old session counts, also one that took this backer's stake off.
  assert.equal(pageVersion({ ...base, sessions: [{ ...session('s1', 100, 400), stakes: [] } as unknown as Session] }), 400);
  // A delete counts (the item is gone, its time stays); deletes in other lists don't.
  assert.equal(pageVersion({ ...base, deleted: { 'payments:p9': 500, 'hands:h1': 900 } }), 500);
  // Older copies without updatedAt fall back to when the session started or ended.
  assert.equal(pageVersion({ ...base, sessions: [{ ...session('s2', 200), endedAt: 260 } as Session], payments: [] }), 260);
});

test('a phone with old data has a lower version than the one that has everything', () => {
  const fresh = { ...base, sessions: [session('s1', 100, 150), session('s2', 200, 220)], payments: [payment('p1', 120), payment('p2', 230)] };
  const stale = { ...base };
  assert.ok(pageVersion(stale) < pageVersion(fresh));
});
