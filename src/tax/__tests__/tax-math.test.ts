/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReport } from '../../export/report';
import { reportHtml } from '../../export/report-html';
import type { Session, Trip } from '../../store/types';
import { countryOfVenue, countryOrder, flag } from '../countries';
import { taxReport, usLossShare } from '../tax-math';

const at = (y: number, m: number, d: number) => new Date(y, m, d, 20).getTime();
const sess = (id: string, over: Partial<Session>): Session => ({
  id, kind: 'mtt', name: 'Event', venue: 'Aria', currency: '$', startedAt: at(2026, 5, 1), endedAt: at(2026, 5, 1) + 5 * 3600000, breaks: [], buyIn: 1000, entries: 1, addOn: 0, cashOut: 0,
  sb: 0, bb: 0, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', country: 'US', ...over,
});
const year = { from: new Date(2026, 0, 1).getTime(), to: new Date(2027, 0, 1).getTime() - 1 };

test('per country: winnings, losses and tax withheld to recover', () => {
  const list = [
    sess('a', { cashOut: 11000, withheld: { amount: 3000, form: '1042-S', status: 'recover' }, docs: [{ id: 'd', name: '1042-S.pdf', file: 'd.pdf', kind: 'form', addedAt: 0 }] }),
    sess('b', { cashOut: 0 }),
    sess('c', { cashOut: 400, expenses: 100 }),
    sess('pt', { country: 'PT', venue: 'Estoril', currency: '€', buyIn: 200, cashOut: 50 }),
    sess('none', { country: undefined, currency: '€', buyIn: 100, cashOut: 300 }),
  ];
  const r = taxReport(list, year);
  assert.deepEqual(r.rows.map((x) => x.country), ['US', 'PT', '']);
  const us = r.rows[0];
  assert.deepEqual([us.sessions, us.wins, us.losses, us.net], [3, 10000, 1000 + 600, 10000 - 1600], 'expenses stay out of the gambling result');
  assert.deepEqual([us.withheld, us.toRecover, us.recovered, us.docs], [3000, 3000, 0, 1]);
  assert.deepEqual(r.pending, [{ currency: '$', amount: 3000 }]);
  assert.deepEqual(r.expenses, [{ currency: '$', byKind: { flight: 0, hotel: 0, food: 0, coaching: 0, software: 0, other: 0 }, sessions: 100, total: 100 }]);
});

test('US filers deduct 90% of losses from 2026, never more than the winnings', () => {
  assert.equal(usLossShare(2025), 1);
  assert.equal(usLossShare(2026), 0.9);
  const even = taxReport([sess('w', { cashOut: 11000 }), sess('l', { buyIn: 10000 })], year).us![0];
  assert.deepEqual([even.wins, even.losses, even.deductible, even.taxable, even.lostToCap], [10000, 10000, 9000, 1000, 1000]);
  const down = taxReport([sess('w', { cashOut: 2000 }), sess('l', { buyIn: 5000 })], year).us![0];
  assert.deepEqual([down.deductible, down.taxable, down.lostToCap], [1000, 0, 0], 'losing year: the cap does not bite');
  const old = taxReport([sess('w', { cashOut: 11000, startedAt: at(2025, 5, 1), endedAt: at(2025, 5, 2) }), sess('l', { buyIn: 10000, startedAt: at(2025, 6, 1), endedAt: at(2025, 6, 2) })], {}).us![0];
  assert.equal(old.taxable, 0);
  assert.equal(taxReport([sess('pt', { country: 'PT' })], year).us, null, 'nothing points at the US');
});

test('the PDF has the tax section only when there is tax data, and says it is not tax advice', () => {
  const list = [sess('a', { cashOut: 5000, withheld: { amount: 1200, form: 'W-2G', status: 'final' } })];
  const report = buildReport({ sessions: list, transfers: [], bankrolls: [], range: year });
  const tax = taxReport(list, year);
  assert.deepEqual(tax.pending, [], 'a W-2G marked as paid is not pending');
  const html = reportHtml(report, { now: at(2026, 9, 17), tax });
  assert.match(html, /Impostos por país/);
  assert.match(html, /Se declaras impostos nos EUA/);
  assert.match(html, /não é aconselhamento fiscal/);
  assert.doesNotMatch(reportHtml(report, { now: 0 }), /Impostos por país/);
  const plain = [sess('x', { country: undefined })];
  assert.doesNotMatch(reportHtml(buildReport({ sessions: plain, transfers: [], bankrolls: [], range: year }), { now: 0, tax: taxReport(plain, year) }), /Impostos por país/, 'no country and nothing withheld');
});

test('trip expenses go in by kind', () => {
  const list = [sess('a', { cashOut: 5000, startedAt: at(2026, 5, 1) })];
  const trip: Trip = { id: 't', name: 'Vegas', venue: 'Aria', currency: '$', from: at(2026, 4, 30), to: at(2026, 5, 3), expenses: [{ id: 'e', kind: 'flight', amount: 900, currency: '$', at: at(2026, 4, 30), note: '' }, { id: 'f', kind: 'coaching', amount: 300, currency: '$', at: at(2026, 5, 1), note: '' }], createdAt: 0 };
  const report = buildReport({ sessions: list, transfers: [], bankrolls: [], range: year, trips: [trip] });
  const tax = taxReport(list, year, report.trips);
  assert.deepEqual([tax.expenses[0].byKind.flight, tax.expenses[0].byKind.coaching, tax.expenses[0].total], [900, 300, 1200]);
  const html = reportHtml(report, { now: 0, tax });
  assert.match(html, /Despesas de póquer por tipo/);
  assert.match(html, /Voo/);
});

test('a venue remembers its country', () => {
  const list = [sess('a', { venue: 'Aria', country: 'US' }), sess('b', { venue: 'Casino Estoril', country: 'PT', startedAt: at(2026, 7, 1) })];
  assert.equal(countryOfVenue(' aria ', list), 'US');
  assert.equal(countryOfVenue('Nowhere', list), undefined);
  assert.deepEqual(countryOrder(list).slice(0, 3), ['PT', 'US', 'ES']);
  assert.equal(flag('PT'), '🇵🇹');
});

test('with backers the withheld tax stays whole, with a note, and the PDF says what results include', () => {
  const backed = sess('s', { cashOut: 10000, stakes: [{ share: 40, markup: 1 }], withheld: { amount: 2400, form: 'W-2G', status: 'final' } });
  const tax = taxReport([backed, sess('p', { buyIn: 500, swapNet: 50 })], year);
  assert.equal(tax.rows[0].withheld, 2400, 'not split by the backers’ share');
  assert.equal(tax.rows[0].backedWithheld, true);
  assert.equal(tax.sharesIncluded, true);
  const html = reportHtml(buildReport({ sessions: [backed], transfers: [], bankrolls: [], range: year }), { now: 0, tax });
  assert.match(html, /formulário 5754/);
  assert.match(html, /Inclui swaps e a tua parte dos pacotes de staking/);
  const own = taxReport([sess('o', { cashOut: 5000, withheld: { amount: 1200, form: 'W-2G', status: 'final' } })], year);
  assert.deepEqual([own.rows[0].backedWithheld, own.sharesIncluded], [false, false]);
  const plain = reportHtml(buildReport({ sessions: [], transfers: [], bankrolls: [], range: year }), { now: 0, tax: own });
  assert.doesNotMatch(plain, /5754|pacotes de staking/);
});
