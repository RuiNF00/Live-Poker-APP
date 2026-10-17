/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BAHAMAS_DEC_2026 as F } from '../../poker/festivals';
import { newOffer, offerEvents, offerTotals, payload, reservationLabel, reservationPrice, setAllShares, stakesFor, taken, withOfferStakes, type ActionOffer, type Reservation } from '../action-offer';

// Event 2 ($26,000), event 3 ($50,000), and a Day 2 that can't be sold.
const picked = ['2', '3', '12-2A'];

test('a new offer sells 30% of each picked event, never a Day 2', () => {
  const o = newOffer(F, picked, 'o1', 1);
  assert.deepEqual(Object.keys(o.shares).sort(), ['2', '3']);
  assert.deepEqual(offerEvents(F, o).map((e) => e.id), ['2', '3']);
});

test('totals: price with markup, what the player keeps and puts in', () => {
  const o: ActionOffer = { ...newOffer(F, picked, 'o1', 1), markup: 1.2, shares: { '2': 50, '3': 20 } };
  const t = offerTotals(F, o);
  assert.equal(t.buyIns, 76000);
  assert.equal(t.face, 13000 + 10000);
  assert.equal(t.price, 27600);
  assert.equal(t.premium, 4600);
  assert.equal(t.outOfPocket, 76000 - 27600);
  assert.equal(t.perPct, 912);
  assert.equal(setAllShares(o, 25).shares['3'], 25);
});

test('the public payload carries no venue or notes and has a generic title', () => {
  const o = newOffer(F, picked, 'o1', 1);
  const p = payload(F, o, '  Rui  ', 'Festival de dezembro', 5);
  assert.equal(p.player, 'Rui');
  assert.equal(p.events.length, 2);
  assert.equal(p.events[0].b, 26000);
  assert.equal(p.events[0].s, 30);
  assert.ok(!JSON.stringify(p).includes('Baha Mar'));
});

const res = (id: string, status: Reservation['status'], shares: Reservation['shares']): Reservation => ({ id, name: id, shares, status, createdAt: '' });

test('reservations: price, taken and the stakes a confirmed one puts on a session', () => {
  const o: ActionOffer = {
    ...newOffer(F, picked, 'o1', 1),
    markup: 1.1,
    reservations: [
      res('a', 'confirmed', [{ e: '2', p: 10 }, { e: '3', p: 10 }]),
      res('b', 'pending', [{ e: '2', p: 5 }]),
      res('c', 'declined', [{ e: '2', p: 15 }]),
      res('d', 'confirmed', [{ e: '3', p: 5 }]),
    ],
    deals: { a: { backerId: 'bA', packageId: 'pA', paid: true }, d: { backerId: 'bD', packageId: 'pD' } },
  };
  assert.equal(reservationPrice(F, o, o.reservations![0]), 8360);
  assert.deepEqual(taken(o.reservations), { '2': 15, '3': 15 });
  assert.deepEqual(reservationLabel(o.reservations![0]), { pct: 10, events: 2 });
  assert.deepEqual(stakesFor([o], F.id, '2'), [{ backerId: 'bA', packageId: 'pA', share: 10, markup: 1.1, unpaid: undefined }]);
  const s3 = stakesFor([o], F.id, '3');
  assert.equal(s3.length, 2);
  assert.equal(s3[1].unpaid, true);
  assert.deepEqual(stakesFor([o], 'other', '2'), []);
  // Re-applying replaces the offer's own stakes and keeps the ones added by hand.
  const byHand = { backerId: 'x', share: 5, markup: 1 };
  const next = withOfferStakes([byHand, { backerId: 'bA', packageId: 'pA', share: 99, markup: 1 }], s3, new Set(['pA', 'pD']));
  assert.deepEqual(next, [byHand, ...s3]);
});

test('a confirmed reservation reuses the backer with the same name', async () => {
  const { dealRecords } = await import('../action-offer');
  const r = res('x', 'pending', [{ e: '2', p: 10 }, { e: '3', p: 10 }]);
  const mine = [{ id: 'b9', name: ' X ', note: '', createdAt: 0 }];
  const a = dealRecords(r, mine, 'Festival', 1.15, { backer: 'nb', pkg: 'np' }, 5);
  assert.equal(a.isNew, false);
  assert.equal(a.pkg.backerId, 'b9');
  assert.equal(a.pkg.share, 10);
  assert.equal(a.pkg.markup, 1.15);
  const b = dealRecords({ ...r, name: 'Ana', contact: '+351 9' }, mine, 'Festival', 1, { backer: 'nb', pkg: 'np' }, 5);
  assert.equal(b.isNew, true);
  assert.equal(b.backer.note, '+351 9');
});
