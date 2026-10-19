/// <reference types="node" />
// One month of a player's money through the same pipeline the store runs
// (makeup cuts, then swaps), checked everywhere it adds up: the balance,
// "Outubro até agora" (the month recap), the trip, the PDF report and the tax
// view. Nothing counted twice, no currencies mixed.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReport } from '../../export/report';
import { gamblingResult, taxReport } from '../../tax/tax-math';
import { balanceOf } from '../bankroll-math';
import { monthRecap } from '../month-recap';
import { profit } from '../session-math';
import { withCuts } from '../staking';
import { withSwaps, type Swap } from '../swaps';
import { tripSummary } from '../trip-math';
import type { Bankroll, Session, StakePackage, Transfer, Trip } from '../types';

const at = (d: number, h: number) => new Date(2026, 8, d, h).getTime();
const cents = (n: number) => Math.round(n * 100) / 100;

function base(over: Partial<Session>): Session {
  return {
    id: 'x', kind: 'mtt', name: '', venue: 'Casino', currency: '€', bankrollId: 'br_eur', startedAt: 0, endedAt: 0, breaks: [],
    buyIn: 0, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
  };
}

const bankrolls: Bankroll[] = [
  { id: 'br_eur', name: 'Principal', currency: '€', createdAt: 1 },
  { id: 'br_usd', name: 'Dólares', currency: '$', createdAt: 2 },
];
const transfers: Transfer[] = [
  { id: 'dep', bankrollId: 'br_eur', kind: 'deposit', amount: 10000, at: at(1, 10), note: '' },
  { id: 'wd', bankrollId: 'br_eur', kind: 'withdrawal', amount: 2000, at: at(28, 10), note: '' },
];

// Tournament: a rebuy and a re-entry (3 entries of 200), 1 500 prize.
const rebuy = base({ id: 'rebuy', name: 'Deepstack', buyIn: 200, entries: 3, cashOut: 1500, startedAt: at(3, 14), endedAt: at(3, 22) });
// Main event in a 5% / 3% swap: 10 000 prize, linked to the swap.
const main = base({ id: 'main', name: 'Main Event', buyIn: 1000, cashOut: 10000, startedAt: at(5, 12), endedAt: at(5, 23) });
// Two turbos half sold into a makeup package (cut 50%): −300 then +1 200 for the whole action.
const stake = { backerId: 'b1', packageId: 'p1', share: 50, markup: 1 };
const pk1 = base({ id: 'pk1', name: 'Turbo', buyIn: 300, stakes: [stake], startedAt: at(8, 15), endedAt: at(8, 18) });
const pk2 = base({ id: 'pk2', name: 'Turbo', buyIn: 300, cashOut: 1500, stakes: [stake], startedAt: at(9, 15), endedAt: at(9, 19) });
// A trip in dollars (1 $ = 0,9 €): cash in dollars and a cash game in euros on the way.
const usd = base({ id: 'usd', kind: 'cash', bankrollId: 'br_usd', currency: '$', name: 'NLH 5/10', sb: 5, bb: 10, buyIn: 1000, cashOut: 1800, startedAt: at(20, 19), endedAt: at(20, 23) });
const eurOnTrip = base({ id: 'eurTrip', kind: 'cash', name: 'NLH 2/5', sb: 2, bb: 5, buyIn: 500, cashOut: 800, startedAt: at(19, 20), endedAt: at(19, 23) });

const packages: StakePackage[] = [{ id: 'p1', backerId: 'b1', name: 'Setembro', kind: 'makeup', share: 50, markup: 1, playerCut: 50, currency: '€', createdAt: at(1, 0) }];
const swaps: Swap[] = [
  {
    id: 'sw1', token: 't', side: 'a', confirmedAt: at(4, 0), createdAt: at(4, 0), updatedAt: at(6, 0), links: { mine: 'main' },
    terms: { v: 1, scope: 'series', title: 'Festival', venue: 'Casino', currency: '€', a: { name: 'Eu', pct: 5 }, b: { name: 'Ele', pct: 3 }, note: '', createdAt: at(4, 0) },
    entries: [
      { id: 'e1', cid: 'mine', side: 'a', kind: 'result', amount: 10000, event: 'Main Event', finish: 3, at: at(5, 23) },
      { id: 'e2', cid: 'theirs', side: 'b', kind: 'result', amount: 20000, event: 'High Roller', finish: 1, at: at(6, 1) },
      // Paying the swap off moves no result: it's settling what's already counted.
      { id: 'e3', cid: 'pay', side: 'a', kind: 'payment', amount: 100, event: '', finish: null, at: at(7, 12) },
    ],
  },
];
const trip: Trip = {
  id: 'tr', name: 'Viagem', venue: 'Nassau', currency: '$', from: at(19, 0), to: at(22, 0), createdAt: 1,
  fx: { currency: '€', rate: 0.9 },
  expenses: [
    { id: 'x1', kind: 'hotel', amount: 700, currency: '$', at: at(19, 12), note: '' },
    { id: 'x2', kind: 'flight', amount: 450, currency: '€', at: at(19, 8), note: '' },
  ],
};

// What the store shows: makeup cuts first, then swaps (store.tsx).
const raw = [rebuy, main, pk1, pk2, usd, eurOnTrip];
const sessions = withSwaps(withCuts(raw, packages), swaps);
const get = (id: string) => sessions.find((s) => s.id === id)!;

// By hand. Swap: −5% of my 10 000, +3% of their 20 000 (lands on the main, my latest session before it).
// Package: backer's half of (−300 + 1 200) = 450, cut 50% back to me = 225, credited to the winning turbo.
const EXPECTED = { rebuy: 900, main: 9000 - 500 + 600, pk1: -150, pk2: 600 + 225, eurTrip: 300, usd: 800 };
const EUR = EXPECTED.rebuy + EXPECTED.main + EXPECTED.pk1 + EXPECTED.pk2 + EXPECTED.eurTrip;

test('each session, through the store pipeline', () => {
  for (const [id, v] of Object.entries(EXPECTED)) assert.equal(cents(profit(get(id))), v, id);
  // Running the pipeline again changes nothing: no swap or cut counted twice.
  assert.deepEqual(withSwaps(withCuts(sessions, packages), swaps).map(profit), sessions.map(profit));
  // Swaps turned off in Settings: the store passes no swaps and swapNet goes away.
  assert.equal(cents(profit(withSwaps(sessions, []).find((s) => s.id === 'main')!)), 9000);
});

test('balance, this month, the report and the tax view say the same', () => {
  const bal = balanceOf({ bankrollId: 'br_eur' }, sessions, transfers, bankrolls);
  assert.equal(cents(bal.results), EUR);
  assert.equal(cents(bal.balance), cents(10000 - 2000 + EUR));
  // The dollar bankroll never leaks into the euro one.
  assert.equal(cents(balanceOf({ bankrollId: 'br_usd' }, sessions, transfers, bankrolls).balance), EXPECTED.usd);

  const month = monthRecap(sessions, '2026-09', '€');
  assert.equal(cents(month.profit), EUR);
  assert.equal(month.sessions, 5);
  assert.equal(cents(monthRecap(sessions, '2026-09', '$').profit), EXPECTED.usd);

  const r = buildReport({ sessions, transfers, bankrolls, range: {}, trips: [trip] });
  const eur = r.currencies.find((c) => c.currency === '€')!;
  assert.equal(cents(eur.totals.profit), EUR);
  assert.equal(cents(eur.deposits - eur.withdrawals + eur.totals.profit), cents(bal.balance));
  assert.equal(cents(eur.byMonth.reduce((a, b) => a + b.profit, 0)), EUR);
  assert.equal(cents(r.currencies.find((c) => c.currency === '$')!.totals.profit), EXPECTED.usd);

  // No expenses or tips typed on sessions, so the gambling result is the result.
  const tax = taxReport(sessions, {}, r.trips);
  assert.equal(cents(tax.rows.filter((x) => x.currency === '€').reduce((a, x) => a + x.net, 0)), EUR);
  assert.equal(cents(tax.rows.filter((x) => x.currency === '$').reduce((a, x) => a + x.net, 0)), EXPECTED.usd);
  assert.equal(cents(sessions.reduce((a, s) => a + gamblingResult(s) - profit(s), 0)), 0);
});

test('the trip: poker and expenses in the trip currency, each converted once', () => {
  const s = tripSummary(trip, sessions);
  assert.equal(s.sessions, 2);
  assert.equal(cents(s.poker), cents(EXPECTED.usd + EXPECTED.eurTrip / 0.9));
  assert.equal(cents(s.expenses), cents(700 + 450 / 0.9));
  assert.equal(cents(s.byKind.hotel + s.byKind.flight), cents(s.expenses));
  assert.equal(cents(s.net), cents(s.poker - s.expenses));
  assert.equal(cents(s.converted!.net), cents(s.net * 0.9));
  assert.deepEqual(s.skipped, []);
  // The tax view lists the trip's expenses once, in the trip's currency.
  const tax = taxReport(sessions, {}, [{ trip }]);
  assert.deepEqual(tax.expenses.map((x) => [x.currency, cents(x.total)]), [['$', cents(s.expenses)]]);
  // Trip expenses stay out of the bankroll balance: the balance is the money in the bankroll.
  assert.equal(cents(balanceOf({ bankrollId: 'br_usd' }, sessions, transfers, bankrolls).balance), EXPECTED.usd);
});
