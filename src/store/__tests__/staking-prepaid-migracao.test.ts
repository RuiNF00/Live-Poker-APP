/// <reference types="node" />
// Settle-up and re-entries (paidCost): sessions saved before it read exactly as they did, with no
// rewrite of stored data. A field that is absent keeps the old meaning, so a backup, the other phone
// or a session never opened again all agree. Plus the one path that still made a festival piece paid
// in full for good: marking it paid by hand on the backer's screen.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BAHAMAS_DEC_2026 as F } from '../../poker/festival-data';
import { markPiece, newOffer, offerPackageIds, offerStakeChanges, paidInFull, stakesFor, type ActionOffer } from '../action-offer';
import { backerLedger, stakeDue } from '../staking';
import type { Session, Stake, StakePackage } from '../types';
import { fixSession } from '../validate';

const ana = { id: 'l1', backerId: 'ana', packageId: 'pa', pct: 10, paid: true };
const bruno = { id: 'l2', backerId: 'bruno', packageId: 'pb', pct: 5 };
const offer: ActionOffer = { ...newOffer(F, ['2', '3'], 'o1', 1), markup: 1.2, lines: [ana, bruno] };
const packages: StakePackage[] = [
  { id: 'pa', backerId: 'ana', name: 'Bahamas', kind: 'action', share: 10, markup: 1.2, playerCut: 0, createdAt: 0 },
  { id: 'pb', backerId: 'bruno', name: 'Bahamas', kind: 'action', share: 5, markup: 1.2, playerCut: 0, createdAt: 0 },
];
const event2 = (stakes: Stake[], over: Partial<Session> = {}): Session =>
  ({
    id: 's2', kind: 'mtt', name: 'Event 2', venue: '', currency: '$', startedAt: Date.UTC(2026, 11, 3, 18), endedAt: Date.UTC(2026, 11, 4, 2), breaks: [],
    buyIn: 26000, entries: 2, addOn: 0, cashOut: 200000, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 8, stack: 0, stackLog: [], roster: [], notes: '',
    stakes,
    ...over,
  }) as Session;

// The three shapes a festival piece could be saved in before paidCost, as JSON from the phone.
const OLD = {
  // Paid ahead, not settled: one entry covered.
  prepaid: { backerId: 'ana', packageId: 'pa', share: 10, markup: 1.2, prepaid: true },
  // Settled with the old code: «prepaid» taken off, nothing else.
  settled: { backerId: 'ana', packageId: 'pa', share: 10, markup: 1.2 },
  // Not paid.
  unpaid: { backerId: 'bruno', packageId: 'pb', share: 5, markup: 1.2, unpaid: true },
} as const;
const fromDisk = (stakes: object[], over: Partial<Session> = {}) => fixSession(JSON.parse(JSON.stringify(event2(stakes as Stake[], over))))!;

test('old sessions load unchanged: no field added, nothing rewritten', () => {
  for (const x of Object.values(OLD)) {
    const s = fromDisk([x]);
    assert.deepEqual(s.stakes, [x], JSON.stringify(x));
    assert.equal('paidCost' in s.stakes![0], false);
  }
});

test('old sessions owe what they owed: the same dues and balances, whatever is played after', () => {
  // 2 entries of 26 000, 10% at 1.2: the re-entry of a piece paid ahead is 3 120.
  assert.equal(stakeDue(fromDisk([OLD.prepaid]), OLD.prepaid as Stake), 3120);
  // Settled with the old code: paid in full, even with a third entry played after (that's how it was saved).
  for (const entries of [2, 3]) assert.equal(stakeDue(fromDisk([OLD.settled], { entries }), OLD.settled as Stake), 0);
  // Not paid: the whole piece.
  assert.equal(stakeDue(fromDisk([OLD.unpaid]), OLD.unpaid as Stake), 0.05 * 52000 * 1.2);
  // The backer's balance on an old settled session is the prize share, as before.
  const s = fromDisk([OLD.settled, OLD.unpaid]);
  assert.equal(backerLedger('ana', [s], packages, []).balance, 20000);
  assert.equal(backerLedger('ana', [s], packages, []).unpaid, 0);
});

test('rebuilding an old session\'s festival stakes keeps it as it was', () => {
  const before = offerPackageIds([offer]);
  // Ana's line is paid in the offer: the rebuilt piece comes as «prepaid», and the old settled one stays paid in full.
  const s = event2([OLD.settled as Stake, OLD.unpaid as Stake]);
  const rebuilt = offerStakeChanges([s], [offer], F.id, { '2': 's2' }, before)[0] ?? s;
  const a = rebuilt.stakes!.find((x) => x.packageId === 'pa')!;
  assert.equal(a.prepaid, undefined);
  assert.equal(a.paidCost, undefined);
  assert.equal(stakeDue({ ...rebuilt, entries: 3 }, a), 0);
  // An old prepaid piece is rebuilt as the same prepaid piece: one entry covered.
  const p = event2(stakesFor([offer], F.id, '2'));
  const again = offerStakeChanges([p], [offer], F.id, { '2': 's2' }, before)[0] ?? p;
  assert.deepEqual(again.stakes, p.stakes);
});

test('a festival piece marked paid by hand: a re-entry played after it is still due', () => {
  const s = event2(stakesFor([offer], F.id, '2'));
  const [a, b] = s.stakes!;
  // Ana owes the re-entry (3 120); a tap on «Pago» used to take off prepaid, and a third entry was free.
  const paidA = markPiece(s, a, true, true);
  assert.equal(paidA.paidCost, 52000);
  assert.equal(stakeDue(s, paidA), 0);
  assert.equal(stakeDue({ ...s, entries: 3 }, paidA), 3120);
  // Bruno's unpaid festival piece, marked paid: the same.
  const paidB = markPiece(s, b, true, true);
  assert.equal(paidB.unpaid, undefined);
  assert.equal(stakeDue({ ...s, entries: 3 }, paidB), 0.05 * 26000 * 1.2);
  // And it reads as settled to paidInFull: settling again changes nothing.
  assert.equal(paidInFull([{ ...s, stakes: [paidA, paidB] }], new Set(['pa', 'pb'])).length, 0);
  // «Not paid after all»: the whole piece again.
  assert.equal(stakeDue(s, markPiece(s, paidA, false, true)), 0.1 * 52000 * 1.2);
  // A piece sold by hand (no festival offer) marked paid: paid in full, as before.
  const hand: Stake = { backerId: 'carla', share: 5, markup: 1, unpaid: true };
  const paidHand = markPiece(s, hand, true, false);
  assert.deepEqual([paidHand.unpaid, paidHand.prepaid, paidHand.paidCost], [undefined, undefined, undefined]);
  assert.equal(stakeDue({ ...s, entries: 3 }, paidHand), 0);
});
