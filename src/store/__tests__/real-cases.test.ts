/// <reference types="node" />
// Real cases a live player hits, checked to the cent everywhere the result
// shows up: the session, Bankroll, the PDF report, the CSV, the hourly, the
// total in the player's own currency and the tax view. A wrong profit is the
// first thing players review-bomb a tracker for.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReport } from '../../export/report';
import { gamblingResult } from '../../tax/tax-math';
import { balanceOf } from '../bankroll-math';
import { sessionsCsv } from '../backup';
import { homeTotals } from '../fx-math';
import { bagDay, resumeDay } from '../multi-day';
import { playedMs, profit, totals } from '../session-math';
import type { Bankroll, Session, Transfer } from '../types';

const H = 3600000;
const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
const cents = (n: number) => Math.round(n * 100) / 100;

function base(over: Partial<Session>): Session {
  return {
    id: 'x', kind: 'cash', name: 'NLH 2/5', venue: 'Casino Estoril', currency: '€', startedAt: 0, endedAt: 0, breaks: [],
    buyIn: 0, entries: 1, addOn: 0, cashOut: 0, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
  };
}

const bankrolls: Bankroll[] = [
  { id: 'br_eur', name: 'Principal', currency: '€', createdAt: 1 },
  { id: 'br_usd', name: 'Dólares', currency: '$', createdAt: 2 },
];
const transfers: Transfer[] = [{ id: 't1', bankrollId: 'br_eur', kind: 'deposit', amount: 10000, at: at(1, 10), note: '' }];

// Cash: two rebuys, a 300 top-up, tips and parking; 20:30 to 02:15 with a 15-minute break.
const rebuys = base({
  id: 'rebuys', bankrollId: 'br_eur', buyIn: 500, entries: 3, addOn: 300, cashOut: 2100.37, tips: 45, expenses: 30,
  startedAt: at(12, 20, 30), endedAt: at(13, 2, 15), breaks: [{ start: at(12, 23), end: at(12, 23, 15) }], handsDealt: 165,
});

// Tournament over two days: two re-entries, an add-on, 30% sold at 1.2 markup.
let mtt = base({
  id: 'main', kind: 'mtt', bankrollId: 'br_eur', name: 'Main Event', buyIn: 1100, entries: 3, addOn: 100,
  stakes: [{ share: 30, markup: 1.2 }], startedAt: at(14, 12), endedAt: undefined, sb: 100, bb: 200, stack: 30000,
});
mtt = bagDay(mtt, 412000, at(14, 22));
mtt = resumeDay(mtt, at(15, 13));
mtt = { ...mtt, endedAt: at(15, 19), cashOut: 12000, finish: 9, field: 812 };

// Cash in dollars on a trip.
const dollars = base({ id: 'usd', bankrollId: 'br_usd', currency: '$', name: 'NLH 5/10', venue: 'Nassau', sb: 5, bb: 10, buyIn: 1000, cashOut: 400, tips: 20, startedAt: at(20, 19), endedAt: at(20, 23) });

// Half sold in a makeup package (no markup), the player's cut credited by the package.
const pkg = base({ id: 'pkg', kind: 'mtt', bankrollId: 'br_eur', name: 'Turbo', buyIn: 250, stakes: [{ share: 50, markup: 1, packageId: 'p1' }], makeupCut: 62.5, startedAt: at(21, 15), endedAt: at(21, 18) });

const sessions = [rebuys, mtt, dollars, pkg];
const EXPECTED = { rebuys: 225.37, main: 6224, usd: -620, pkg: -62.5 };
const EUR = 225.37 + 6224 - 62.5;

test('each session: rebuys, top-up, tips, re-entries, add-on, staking, makeup', () => {
  // 2100.37 − (3 × 500 + 300) − 30 − 45
  assert.equal(cents(profit(rebuys)), EXPECTED.rebuys);
  // 12000 − 30% to backers − (3400 − 30% × 3400 × 1.2 they paid)
  assert.equal(cents(profit(mtt)), EXPECTED.main);
  assert.equal(cents(profit(dollars)), EXPECTED.usd);
  // −250 + half paid by the package + the player's cut
  assert.equal(cents(profit(pkg)), EXPECTED.pkg);
});

test('hours leave out breaks and the night between days', () => {
  assert.equal(playedMs(rebuys) / H, 5.5);
  assert.equal(playedMs(mtt) / H, 16);
});

test('Bankroll, totals and hourly agree', () => {
  const eur = sessions.filter((s) => s.currency === '€');
  const tot = totals(eur, '€');
  assert.equal(cents(tot.profit), cents(EUR));
  assert.equal(tot.hours, 24.5);
  assert.equal(cents(tot.hourly * tot.hours), cents(EUR));
  assert.equal(tot.tips, 45);
  assert.equal(tot.handsPerHour, 30, '165 hands in 5.5 h, only where counted');
  const bal = balanceOf({ bankrollId: 'br_eur' }, sessions, transfers, bankrolls);
  assert.equal(cents(bal.results), cents(EUR));
  assert.equal(cents(bal.balance), cents(10000 + EUR));
  assert.equal(cents(balanceOf({ bankrollId: 'br_usd' }, sessions, transfers, bankrolls).results), EXPECTED.usd);
});

test('the PDF report says the same, and its splits add up', () => {
  const r = buildReport({ sessions, transfers, bankrolls, range: {} });
  const eur = r.currencies.find((c) => c.currency === '€')!;
  assert.equal(cents(eur.totals.profit), cents(EUR));
  assert.equal(cents(eur.cash.profit + eur.mtt.profit), cents(EUR));
  for (const split of [eur.byMonth, eur.byVenue, eur.byGame, eur.byBankroll]) assert.equal(cents(split.reduce((a, b) => a + b.profit, 0)), cents(EUR));
  assert.equal(eur.totals.tips, 45);
  assert.equal(cents(eur.owedToBackers), 3600);
  assert.equal(cents(r.currencies.find((c) => c.currency === '$')!.totals.profit), EXPECTED.usd);
});

test('the CSV has local date and time, hours, venue, tips and the same profit', () => {
  const [head, ...rows] = sessionsCsv(sessions, bankrolls).trim().split('\n');
  const cols = head.split(',');
  const col = (r: string, k: string) => r.split(',')[cols.indexOf(k)];
  const sessionRows = rows.filter((r) => ['cash', 'mtt'].includes(col(r, 'type')));
  const sum = (cur: string, k: string) => sessionRows.filter((r) => col(r, 'currency') === cur).reduce((a, r) => a + Number(col(r, k) || 0), 0);
  assert.equal(cents(sum('€', 'profit')), cents(EUR));
  assert.equal(cents(sum('$', 'profit')), EXPECTED.usd);
  assert.equal(sum('€', 'hours'), 24.5);
  assert.equal(sum('€', 'tips') + sum('$', 'tips'), 65);
  const first = sessionRows.find((r) => col(r, 'venue') === 'Casino Estoril' && col(r, 'type') === 'cash')!;
  // Started 20:30 on the 12th, local: never shifted to another day by UTC.
  assert.equal(col(first, 'date'), '2026-09-12');
  assert.equal(col(first, 'start_time'), '20:30');
  assert.equal(col(first, 'hands'), '165');
});

test('the total in the home currency converts each session at its day\'s rate', () => {
  const rates = { '2026-09-01': { USD: 1.25 } };
  const h = homeTotals({ sessions, transfers, bankrolls }, '€', rates, {});
  assert.equal(cents(h.profit), cents(EUR + EXPECTED.usd / 1.25));
});

test('the tax view adds back expenses and tips, nothing else', () => {
  assert.equal(cents(gamblingResult(rebuys)), cents(EXPECTED.rebuys + 30 + 45));
  assert.equal(cents(gamblingResult(mtt)), EXPECTED.main);
});
