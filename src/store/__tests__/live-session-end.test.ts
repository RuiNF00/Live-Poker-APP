/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { liveSnapshot, liveStatus } from '../../lib/live-link';
import { claimOnce } from '../../lib/once';
import { bagDay } from '../multi-day';
import { endCashOut, rescaleStackLog, type EndForm } from '../session-math';
import type { Session } from '../types';

const H = 3_600_000;
function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: 0, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}
const form = (over: Partial<EndForm> = {}): EndForm => ({ cashOut: null, bounties: 0, place: 0, field: 0, tips: 0, handsDealt: 0, ...over });

test('a backer sees a bagged Day 1 as bagged, not as a bust, and its clock stops', () => {
  const day1 = bagDay(mk({ stack: 41000 }), 52000, 6 * H);
  const snap = liveSnapshot(day1, 'Jogador-A1B2', 0, 6 * H);
  assert.equal(liveStatus(snap, 6 * H, 7 * H, 45 * 60000), 'bagged');
  // Still bagged the next morning: not «Sem atualizações».
  assert.equal(liveStatus(snap, 6 * H, 20 * H, 45 * 60000), 'bagged');
  const busted = liveSnapshot({ ...mk(), endedAt: 6 * H }, 'Jogador-A1B2', 0, 6 * H);
  assert.equal(liveStatus(busted, 6 * H, 7 * H, 45 * 60000), 'ended');
  const live = liveSnapshot(mk(), 'Jogador-A1B2', 0, H);
  assert.equal(liveStatus(live, H, H + 60000, 45 * 60000), 'live');
  assert.equal(liveStatus(live, H, 2 * H, 45 * 60000), 'stale');
});

test('cash: until it is typed, the cash-out follows the live stack (a rebuy or «Anular» with the form open)', () => {
  const s = mk({ kind: 'cash', stack: 400 });
  assert.equal(endCashOut(form(), s), 400);
  // «Anular» on a rebuy put the stack back to 200 while the form was open.
  assert.equal(endCashOut(form(), { ...s, stack: 200 }), 200);
  // Typed: it stays what was typed.
  assert.equal(endCashOut(form({ cashOut: 350 }), { ...s, stack: 200 }), 350);
  assert.equal(endCashOut(form({ cashOut: 0 }), s), 0);
});

test('tournament: until it is typed, the prize follows the payout for the place', () => {
  const s = mk({ tourney: { payouts: [5000, 3000, 2000] } as Session['tourney'] });
  assert.equal(endCashOut(form({ place: 2 }), s), 3000);
  assert.equal(endCashOut(form({ place: 3 }), s), 2000);
  assert.equal(endCashOut(form({ place: 9 }), s), 0);
  assert.equal(endCashOut(form({ place: 0 }), s), 0);
  assert.equal(endCashOut(form({ place: 2, cashOut: 2800 }), s), 2800);
});

test('editing the time of a finished session keeps its stack chart, stretched onto the new times', () => {
  const log = [{ t: 0, stack: 100 }, { t: 2 * H, stack: 300 }, { t: 4 * H, stack: 250 }];
  const out = rescaleStackLog(log, { start: 0, end: 4 * H }, { start: 10 * H, end: 12 * H });
  assert.deepEqual(out.map((p) => p.t), [10 * H, 11 * H, 12 * H]);
  assert.deepEqual(out.map((p) => p.stack), [100, 300, 250]);
  // A point outside the old times (a stack saved just after the end) stays inside the new ones.
  assert.equal(rescaleStackLog([{ t: 5 * H, stack: 1 }], { start: 0, end: 4 * H }, { start: 0, end: H })[0].t, H);
});

test('a second tap on «Guardar» does nothing; the next session closes again', () => {
  const ref = { current: null as string | null };
  assert.equal(claimOnce(ref, 'a'), true);
  assert.equal(claimOnce(ref, 'a'), false);
  assert.equal(claimOnce(ref, 'b'), true);
});
