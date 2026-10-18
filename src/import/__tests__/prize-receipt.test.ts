/// <reference types="node" />
// Payout slips the way the phone reads them: one string per line, capitals, stray characters.
// What isn't there stays undefined.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePrizeReceipt } from '../prize-receipt';

test('a European payout slip: gross prize over the tax held back, place, event', () => {
  const g = parsePrizeReceipt(['CASINO LISBOA', 'POKER PAYOUT', 'EVENT #4 NLH 1.100€', 'PLACE: 7', 'GROSS PRIZE: 4.850,00 €', 'TAX WITHHELD: 970,00 €', 'NET: 3.880,00 €', '17/10/2026 23:41']);
  assert.equal(g.amount, 4850);
  assert.equal(g.finish, 7);
  assert.equal(g.currency, '€');
  assert.match(g.event ?? '', /#4/);
});

test('a US slip with an ordinal place and a dollar prize', () => {
  const g = parsePrizeReceipt(['TOURNAMENT PAYOUT RECEIPT', 'Event 12 - $1,500 PLO', '18th Place', 'Payout $6,214', 'Players 1,204']);
  assert.equal(g.amount, 6214);
  assert.equal(g.finish, 18);
  assert.equal(g.currency, '$');
});

test('Portuguese and Spanish labels', () => {
  const pt = parsePrizeReceipt(['Torneio Main Event', 'Classificação: 5º', 'Prémio 9.600 €', 'Imposto do selo 960 €']);
  assert.equal(pt.amount, 9600);
  assert.equal(pt.finish, 5);
  const es = parsePrizeReceipt(['Puesto 31', 'Premio: 2.100,50 €', 'Retención IRPF: 420,10 €']);
  assert.equal(es.amount, 2100.5);
  assert.equal(es.finish, 31);
});

test('only the net to receive: that is what is read', () => {
  const g = parsePrizeReceipt(['Main Event', 'Valor líquido a receber 1.220 €']);
  assert.equal(g.amount, 1220);
});

test('no labels: the biggest amount, never the buy-in, the pool or a date', () => {
  const g = parsePrizeReceipt(['Deepstack 250€', 'Buy-in 250 €', 'Prize pool 48.000 €', '3.400 €', '17/10/2026']);
  assert.equal(g.amount, 3400);
  assert.equal(g.finish, undefined);
});

test('nothing readable: nothing guessed', () => {
  assert.deepEqual(parsePrizeReceipt(['thank you', 'good luck']), {});
});
