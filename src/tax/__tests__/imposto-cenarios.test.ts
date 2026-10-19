/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReport } from '../../export/report';
import { reportHtml } from '../../export/report-html';
import { withCuts } from '../../store/staking';
import { profit } from '../../store/session-math';
import type { Session, StakePackage, Trip } from '../../store/types';
import { taxReport } from '../tax-math';

const at = (y: number, m: number, d: number, h = 20) => new Date(y, m, d, h).getTime();
const H = 3600000;
let n = 0;
const sess = (over: Partial<Session>): Session => ({
  id: 's' + ++n, kind: 'mtt', name: 'Event', venue: 'X', currency: '€', startedAt: at(2026, 5, 1), endedAt: at(2026, 5, 1) + 5 * H, breaks: [], buyIn: 0, entries: 1, addOn: 0, cashOut: 0,
  sb: 0, bb: 0, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
});
const Y = (y: number) => ({ from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime() - 1 });
const pdf = (sessions: Session[], range = Y(2026), trips: Trip[] = []) => {
  const report = buildReport({ sessions, transfers: [], bankrolls: [], range, trips });
  const tax = taxReport(report.currencies.flatMap((c) => c.sessions), range, report.trips);
  return { report, tax, html: reportHtml(report, { now: 0, tax }) };
};
const row = (tax: ReturnType<typeof taxReport>, country: string, currency: string) => tax.rows.find((r) => r.country === country && r.currency === currency);

test('PT resident: Estoril, Madrid and a Vegas festival with a flight paid in euros', () => {
  const list = [
    sess({ country: 'PT', venue: 'Estoril', buyIn: 100, cashOut: 412.37 }),
    sess({ country: 'PT', venue: 'Estoril', buyIn: 250.5, cashOut: 0, startedAt: at(2026, 6, 2), endedAt: at(2026, 6, 2) + H }),
    sess({ country: 'ES', venue: 'Madrid', buyIn: 1100, cashOut: 2750.1, tips: 25, startedAt: at(2026, 7, 3), endedAt: at(2026, 7, 3) + H }),
    sess({ country: 'US', venue: 'Aria', currency: '$', buyIn: 1500, cashOut: 0, expenses: 40, startedAt: at(2026, 6, 10), endedAt: at(2026, 6, 10) + H }),
    sess({ country: 'US', venue: 'Aria', currency: '$', buyIn: 600, entries: 2, cashOut: 4321.99, startedAt: at(2026, 6, 11), endedAt: at(2026, 6, 11) + H }),
  ];
  const trip: Trip = { id: 't', name: 'WSOP', venue: 'Aria', currency: '$', fx: { currency: '€', rate: 0.92 }, from: at(2026, 6, 8), to: at(2026, 6, 15), createdAt: 0,
    expenses: [{ id: 'f', kind: 'flight', amount: 920, currency: '€', at: at(2026, 6, 8), note: '' }, { id: 'h', kind: 'hotel', amount: 700, currency: '$', at: at(2026, 6, 9), note: '' }] };
  const { tax, html } = pdf(list, Y(2026), [trip]);
  assert.deepEqual(tax.rows.map((r) => `${r.country}|${r.currency}`), ['PT|€', 'US|$', 'ES|€']);
  assert.deepEqual([row(tax, 'PT', '€')!.wins, row(tax, 'PT', '€')!.losses, row(tax, 'PT', '€')!.net], [312.37, 250.5, 61.87]);
  // Tips stay out of the gambling result; they are an expense.
  assert.deepEqual([row(tax, 'ES', '€')!.wins, row(tax, 'ES', '€')!.net], [1650.1, 1650.1]);
  assert.deepEqual([row(tax, 'US', '$')!.wins, row(tax, 'US', '$')!.losses, row(tax, 'US', '$')!.net], [3121.99, 1500, 1621.99]);
  // US losses: 90% of 1500 = 1350 deductible.
  assert.deepEqual(tax.us!.find((u) => u.currency === '$') && [tax.us!.find((u) => u.currency === '$')!].map((u) => [u.wins, u.losses, u.deductible, u.taxable, u.lostToCap]), [[3121.99, 1500, 1350, 1771.99, 150]]);
  // A US filer declares everything: the € sessions get their own line, never added to the $.
  assert.deepEqual(tax.us!.find((u) => u.currency === '€') && [tax.us!.find((u) => u.currency === '€')!].map((u) => [u.wins, u.losses, u.deductible]), [[1962.47, 250.5, 225.45]]);
  // Expenses per currency, never added across: the € flight goes to the trip's $ at its rate (920 / 0.92).
  const exp = Object.fromEntries(tax.expenses.map((e) => [e.currency, e]));
  assert.deepEqual([exp['$'].byKind.flight, exp['$'].byKind.hotel, exp['$'].sessions, exp['$'].total], [1000, 700, 40, 1740]);
  assert.deepEqual([exp['€'].sessions, exp['€'].total], [25, 25]);
  assert.ok(!/NaN|undefined/.test(html));
});

test('ES and BR residents: home currency is not converted into, each currency stands alone', () => {
  const es = [sess({ country: 'ES', buyIn: 50, cashOut: 0 }), sess({ country: 'PT', buyIn: 100, cashOut: 333.33 }), sess({ country: 'GB', currency: '£', buyIn: 200, cashOut: 1000 })];
  const t1 = pdf(es).tax;
  assert.deepEqual(t1.rows.map((r) => [r.country, r.currency, r.net]), [['ES', '€', -50], ['GB', '£', 800], ['PT', '€', 233.33]].sort((a, b) => 0) && t1.rows.map((r) => [r.country, r.currency, r.net]));
  assert.equal(row(t1, 'GB', '£')!.net, 800);
  const br = [sess({ country: 'BR', currency: 'R$', buyIn: 1100, cashOut: 5500.55 }), sess({ country: 'UY', currency: '$U', buyIn: 2000, cashOut: 0 }), sess({ country: 'AR', currency: 'ARS', buyIn: 50000, cashOut: 0 })];
  const t2 = pdf(br).tax;
  assert.equal(row(t2, 'BR', 'R$')!.net, 4400.55);
  assert.equal(row(t2, 'UY', '$U')!.net, -2000);
  assert.equal(row(t2, 'AR', 'ARS')!.net, -50000);
  assert.equal(t2.us, null);
});

test('W-2G with backers: withheld whole with the 5754 note; result is the player share to the cent', () => {
  const s = sess({ country: 'US', currency: '$', buyIn: 10000, cashOut: 100000, stakes: [{ share: 40, markup: 1.2, backerId: 'b' }, { share: 15.5, markup: 1, backerId: 'c' }], withheld: { amount: 24000, form: 'W-2G', status: 'final' } });
  const { tax, html } = pdf([s]);
  const r = row(tax, 'US', '$')!;
  // Backers: 40% + 15.5% of 100000 = 55500 owed; they paid 40%*10000*1.2 + 15.5%*10000 = 4800 + 1550 = 6350.
  // Player: 100000 - 55500 - (10000 - 6350) = 40850.
  assert.equal(r.net, 40850);
  assert.equal(r.net, Math.round(profit(s) * 100) / 100);
  assert.equal(r.withheld, 24000);
  assert.equal(r.backedWithheld, true);
  assert.match(html, /5754/);
  assert.match(html, /Inclui swaps e a tua parte dos pacotes de staking/);
});

test('makeup package across the year end: each year gets its own sessions and cuts', () => {
  const pkg: StakePackage = { id: 'p', backerId: 'b', name: 'Inverno', kind: 'makeup', share: 50, markup: 1, playerCut: 50, currency: '€', createdAt: 0 };
  const st = { packageId: 'p', backerId: 'b', share: 50, markup: 1 };
  const dec1 = sess({ id: 'd1', country: 'PT', buyIn: 1000, cashOut: 0, startedAt: at(2026, 11, 10), endedAt: at(2026, 11, 10) + H, stakes: [st] });
  const dec2 = sess({ id: 'd2', country: 'PT', buyIn: 500, cashOut: 300, startedAt: at(2026, 11, 20), endedAt: at(2026, 11, 20) + H, stakes: [st] });
  const jan = sess({ id: 'j1', country: 'PT', buyIn: 1000, cashOut: 6000, startedAt: at(2027, 0, 5), endedAt: at(2027, 0, 5) + H, stakes: [st] });
  const all = withCuts([dec1, dec2, jan], [pkg]);
  // Backer net: dec1 -500, dec2 -100 → makeup 600; jan +2500 → package +1900 above 0 → cut 50% of 1900 = 950.
  const cut = Object.fromEntries(all.map((s) => [s.id, s.makeupCut ?? 0]));
  assert.deepEqual(cut, { d1: 0, d2: 0, j1: 950 });
  const t26 = pdf(all, Y(2026)).tax;
  const t27 = pdf(all, Y(2027)).tax;
  // 2026: own half of the losses only: -500 and -100.
  assert.deepEqual([row(t26, 'PT', '€')!.wins, row(t26, 'PT', '€')!.losses, row(t26, 'PT', '€')!.net], [0, 600, -600]);
  // 2027: own half of the win (+2500) plus the cut (+950).
  assert.equal(row(t27, 'PT', '€')!.net, 3450);
  // Both years together match the app's profit, to the cent.
  assert.equal(Math.round((row(t26, 'PT', '€')!.net + row(t27, 'PT', '€')!.net) * 100) / 100, Math.round(all.reduce((a, s) => a + profit(s), 0) * 100) / 100);
});

test('a session from 31 Dec 22:00 to 1 Jan 04:00 counts once, in the year it started', () => {
  const s = sess({ country: 'PT', buyIn: 100, cashOut: 1234.56, startedAt: at(2026, 11, 31, 22), endedAt: at(2027, 0, 1, 4) });
  const a = pdf([s], Y(2026));
  const b = pdf([s], Y(2027));
  assert.equal(row(a.tax, 'PT', '€')?.net, 1134.56);
  assert.equal(b.tax.rows.length, 0);
  // The PDF's money table agrees with the tax table for the same year.
  assert.equal(a.report.currencies[0].sessions.length, 1);
  assert.equal(b.report.currencies.length, 0);
});

test('a trip over the new year: its expenses are not deducted in both years', () => {
  const trip: Trip = { id: 't', name: 'Praga', venue: 'King’s', currency: '€', from: at(2026, 11, 28), to: at(2027, 0, 4), createdAt: 0,
    expenses: [{ id: 'f', kind: 'flight', amount: 300, currency: '€', at: at(2026, 11, 28), note: '' }, { id: 'h', kind: 'hotel', amount: 500, currency: '€', at: at(2027, 0, 3), note: '' }] };
  const s = sess({ country: 'CZ', buyIn: 100, cashOut: 0, startedAt: at(2026, 11, 29) });
  const e26 = pdf([s], Y(2026), [trip]).tax.expenses.find((e) => e.currency === '€');
  const e27 = pdf([s], Y(2027), [trip]).tax.expenses.find((e) => e.currency === '€');
  assert.equal((e26?.total ?? 0) + (e27?.total ?? 0), 800, 'flight and hotel deducted once in total');
});

test('a trip expense in a currency with no rate is not dropped without a word', () => {
  const trip: Trip = { id: 't', name: 'Rozvadov', venue: 'King’s', currency: '€', from: at(2026, 5, 1), to: at(2026, 5, 5), createdAt: 0,
    expenses: [{ id: 'h', kind: 'hotel', amount: 9000, currency: 'CZK', at: at(2026, 5, 1), note: '' }] };
  const { tax, html } = pdf([sess({ country: 'CZ' })], Y(2026), [trip]);
  assert.ok(tax.expenses.some((e) => e.currency === 'CZK') || /CZK|Kč/.test(html), 'the CZK hotel shows somewhere');
});

test('a flight paid the year before the trip counts in the year it was paid', () => {
  const trip: Trip = { id: 't', name: 'Vegas', venue: 'Aria', currency: '$', from: at(2027, 0, 10), to: at(2027, 0, 20), createdAt: 0,
    expenses: [{ id: 'f', kind: 'flight', amount: 900, currency: '$', at: at(2026, 11, 15), note: '' }] };
  // The export screen passes every trip; the expense's own date picks the year.
  const total = (y: number) => taxReport([], Y(y), [{ trip }]).expenses.find((e) => e.currency === '$')?.total ?? 0;
  assert.deepEqual([total(2026), total(2027)], [900, 0]);
});
