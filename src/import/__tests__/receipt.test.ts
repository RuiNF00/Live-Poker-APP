/// <reference types="node" />
// Buy-in receipts the way the phone reads them: one string per line, capitals,
// the odd stray character. What isn't there stays undefined.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseReceipt, usable } from '../receipt';

const day = (ms?: number) => {
  if (ms === undefined) return undefined;
  const d = new Date(ms);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()].join('-');
};

test('a US casino ticket: buy-in and fee on their own lines, table, seat, chips, 12h clock', () => {
  const g = parseReceipt([
    'POKER TOURNAMENT RECEIPT',
    'EVENT #5 NLH MAIN EVENT',
    'DAY 1A',
    'BUY-IN: $2,500.00',
    'FEE: $200.00',
    'TOTAL: $2,700.00',
    'TABLE: 45  SEAT: 7',
    'STARTING CHIPS: 60,000',
    'DATE: 12/05/2026 12:00 PM',
  ]);
  assert.equal(g.name, 'EVENT #5 NLH MAIN EVENT DAY 1A');
  assert.equal(g.currency, '$');
  assert.equal(g.buyIn, 2700);
  assert.equal(g.fee, 200);
  assert.deepEqual([g.table, g.seat, g.stack], [45, 7, 60000]);
  // Dollars and both readings possible: month first.
  assert.equal(day(g.date), '2026-12-5-12-0');
  assert.ok(usable(g));
});

test('a Portuguese casino: "300€ + 50€" on one line, Mesa / Lugar, day first', () => {
  const g = parseReceipt(['Casino', 'Torneio: Deepstack 350', 'Buy-in: 300,00€ + 50,00€', 'Mesa 12 Lugar 4', 'Data: 05-12-2026 20h30']);
  assert.equal(g.name, 'Deepstack 350');
  assert.equal(g.currency, '€');
  assert.equal(g.buyIn, 350);
  assert.equal(g.fee, 50);
  assert.deepEqual([g.table, g.seat], [12, 4]);
  assert.equal(day(g.date), '2026-12-5-20-30');
});

test('Spanish, one total only, ISO date, code instead of a symbol', () => {
  const g = parseReceipt(['TORNEO HIGH ROLLER PKO', 'Importe: 1.100 EUR', 'Mesa 3 Asiento 9', '2026-11-20 18:00']);
  assert.equal(g.name, 'TORNEO HIGH ROLLER PKO');
  assert.equal(g.currency, '€');
  assert.equal(g.buyIn, 1100);
  assert.equal(g.fee, undefined);
  assert.deepEqual([g.table, g.seat], [3, 9]);
  assert.equal(day(g.date), '2026-11-20-18-0');
});

test('no labels at all: "$1,500 + $100" still gives the cost; "Entry fee" is the whole entry', () => {
  assert.equal(parseReceipt(['$1,500 + $100 Bounty Turbo']).buyIn, 1600);
  const e = parseReceipt(['Event #12', 'Entry Fee $600', 'Seat 2']);
  assert.equal(e.buyIn, 600);
  assert.equal(e.fee, undefined);
  assert.equal(e.seat, 2);
});

test('buy-in and fee on one line; named month; time and date are not amounts', () => {
  const g = parseReceipt(['MAIN EVENT', 'Buy-in $5,000   Fee $300', 'Dec 7, 2026 11:00 AM']);
  assert.equal(g.buyIn, 5300);
  assert.equal(day(g.date), '2026-12-7-11-0');
  assert.equal(parseReceipt(['5 dez 2026']).date !== undefined, true);
});

test('a blurry photo with nothing useful is not usable and invents nothing', () => {
  const g = parseReceipt(['THANK YOU', 'GOOD LUCK']);
  assert.deepEqual(g, {});
  assert.equal(usable(g), false);
  assert.equal(parseReceipt([]).buyIn, undefined);
});

test('applyReceipt: the receipt\'s currency picks its bankroll, table and seat go to the notes, a past day is logged as played', async () => {
  const { applyReceipt, seatLine } = await import('../receipt');
  const base = {
    id: 's1', kind: 'cash' as const, name: '', venue: 'Casino', currency: '€', bankrollId: 'eur', startedAt: 0, breaks: [], buyIn: 100, entries: 1, addOn: 0, cashOut: 0,
    sb: 100, bb: 200, ante: 200, anteType: 'bb' as const, tableSize: 9, stack: 30000, stackLog: [], roster: [], notes: '',
  };
  const brs = [{ id: 'eur', name: 'Principal', currency: '€', createdAt: 1 }, { id: 'usd', name: 'Viagens', currency: '$', createdAt: 2 }];
  const doc = { id: 'd1', name: 'foto.jpg', file: 'd1.jpg', kind: 'receipt' as const, addedAt: 1 };
  const now = new Date(2026, 11, 5, 12).getTime();
  const g = { name: 'Main Event', currency: '$', buyIn: 2700, table: 45, seat: 7, stack: 60000, date: new Date(2026, 11, 5, 12).getTime(), hasTime: true };
  const s = applyReceipt(base, g, doc, brs, now);
  assert.equal(s.kind, 'mtt');
  assert.deepEqual([s.name, s.currency, s.bankrollId, s.buyIn, s.stack], ['Main Event', '$', 'usd', 2700, 60000]);
  assert.equal(s.notes, seatLine(g));
  assert.match(s.notes, /45/);
  assert.equal(s.docs?.[0].id, 'd1');
  assert.equal(s.endedAt, undefined);
  // Yesterday's receipt: a finished tournament to fill in.
  const past = applyReceipt(base, { ...g, date: new Date(2026, 11, 4).getTime(), hasTime: false }, doc, brs, now);
  assert.equal(new Date(past.startedAt).getHours(), 18);
  assert.equal(past.endedAt! - past.startedAt, 4 * 3600000);
  // Nothing read: the blank stays, the photo is still attached.
  const none = applyReceipt(base, {}, doc, brs, now);
  assert.deepEqual([none.currency, none.bankrollId, none.buyIn, none.notes], ['€', 'eur', 100, '']);
  assert.equal(none.docs?.length, 1);
});
