/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BAHAMAS_DEC_2026 as F } from '../../poker/festivals';
import { agreement, lineCost, lineRecords, newOffer, offerEvents, offerPackageIds, offerTotals, stakesFor, withOfferStakes, type ActionOffer } from '../action-offer';

// Event 2 ($26,000), event 3 ($50,000), and a Day 2 that has no buy-in.
const picked = ['2', '3', '12-2A'];

test('a new package has the picked events, never a Day 2, and no backers yet', () => {
  const o = newOffer(F, picked, 'o1', 1);
  assert.deepEqual(o.events, ['2', '3']);
  assert.deepEqual(offerEvents(F, o).map((e) => e.id), ['2', '3']);
  assert.equal(o.lines.length, 0);
});

const pkg = (lines: ActionOffer['lines'], markup = 1.2): ActionOffer => ({ ...newOffer(F, picked, 'o1', 1), markup, lines });

test('totals: what backers pay, what the player keeps and puts in', () => {
  const o = pkg([
    { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 },
    { id: 'l2', backerId: 'b2', packageId: 'p2', pct: 5 },
  ]);
  const t = offerTotals(F, o);
  assert.equal(t.buyIns, 76000);
  assert.equal(t.sold, 15);
  assert.equal(t.price, 13680);
  assert.equal(t.premium, 2280);
  assert.equal(t.outOfPocket, 76000 - 13680);
  assert.equal(t.keep, 85);
  assert.equal(lineCost(F, o, 10), 9120);
});

test("a backer's private link carries only their own piece, no venue or other backers", () => {
  const o = pkg([
    { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10 },
    { id: 'l2', backerId: 'b2', packageId: 'p2', pct: 5 },
  ]);
  const p = agreement(F, o, o.lines[1], '  Rui  ', 'Marta', 'Festival de dezembro', 5);
  assert.equal(p.player, 'Rui');
  assert.equal(p.backer, 'Marta');
  assert.deepEqual(p.events.map((e) => [e.b, e.p]), [[26000, 5], [50000, 5]]);
  const json = JSON.stringify(p);
  for (const leak of ['Baha Mar', 'b1', 'p1', '"10"']) assert.ok(!json.includes(leak), leak);
});

test('a new line reuses the backer with the same name and makes a staking package', () => {
  const o = pkg([], 1.15);
  const mine = [{ id: 'b9', name: ' Marta ', note: '', createdAt: 0 }];
  const a = lineRecords('marta', mine, 'Festival', o, 5, { line: 'l', backer: 'nb', pkg: 'np' }, 3);
  assert.equal(a.isNew, false);
  assert.equal(a.line.backerId, 'b9');
  assert.deepEqual([a.pkg.share, a.pkg.markup, a.pkg.kind], [5, 1.15, 'action']);
  assert.equal(lineRecords('Ana', mine, 'Festival', o, 5, { line: 'l', backer: 'nb', pkg: 'np' }).isNew, true);
});

test('sessions from the package events carry each backer, unpaid until marked paid', () => {
  const o = pkg([
    { id: 'l1', backerId: 'b1', packageId: 'p1', pct: 10, paid: true },
    { id: 'l2', backerId: 'b2', packageId: 'p2', pct: 5 },
  ]);
  assert.deepEqual(stakesFor([o], F.id, '2'), [
    { backerId: 'b1', packageId: 'p1', share: 10, markup: 1.2, unpaid: undefined },
    { backerId: 'b2', packageId: 'p2', share: 5, markup: 1.2, unpaid: true },
  ]);
  assert.deepEqual(stakesFor([o], F.id, '1-A'), []);
  assert.deepEqual(stakesFor([o], 'other', '2'), []);
  // Re-applying replaces the package's own stakes and keeps the ones added by hand.
  const byHand = { backerId: 'x', share: 5, markup: 1 };
  const next = withOfferStakes([byHand, { backerId: 'b1', packageId: 'p1', share: 99, markup: 1 }], stakesFor([o], F.id, '3'), offerPackageIds([o]));
  assert.equal(next.length, 3);
  assert.deepEqual(next[0], byHand);
});
