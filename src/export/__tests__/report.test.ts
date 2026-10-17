/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '../../poker/engine';
import { sampleHand } from '../../poker/sample';
import { sessionsCsv } from '../../store/backup';
import { dayKey } from '../../store/fx-math';
import type { Bankroll, Session, Transfer, Trip } from '../../store/types';
import { buildReport, handsCsv } from '../report';
import { reportHtml } from '../report-html';

const at = (m: number, d: number) => new Date(2026, m, d, 20).getTime();
const sess = (id: string, over: Partial<Session>): Session => ({
  id, kind: 'cash', name: 'NLH 1/2', venue: 'Estoril', currency: '€', startedAt: at(0, 1), endedAt: at(0, 1) + 4 * 3600000, breaks: [], buyIn: 200, entries: 1, addOn: 0, cashOut: 300,
  sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
});
const brs: Bankroll[] = [
  { id: 'main', name: 'Principal', currency: '€', createdAt: 1 },
  { id: 'trip', name: 'Vegas', currency: '$', createdAt: 2 },
];
const list = [
  sess('a', {}),
  sess('b', { startedAt: at(1, 3), endedAt: at(1, 3) + 2 * 3600000, venue: 'Lisboa', cashOut: 100 }),
  sess('c', { kind: 'mtt', name: 'Main <Event>', startedAt: at(2, 5), endedAt: at(2, 5) + 6 * 3600000, buyIn: 150, cashOut: 900, finish: 3, field: 120 }),
  sess('d', { currency: '$', bankrollId: 'trip', venue: 'Bellagio', startedAt: at(5, 1), endedAt: at(5, 1) + 3600000, cashOut: 500, format: 'live' }),
  sess('old', { startedAt: new Date(2025, 5, 1).getTime(), endedAt: new Date(2025, 5, 1).getTime() + 3600000 }),
];
const tx: Transfer[] = [{ id: 't', bankrollId: 'main', kind: 'deposit', amount: 1000, at: at(0, 1), note: '' }];
const year = { from: new Date(2026, 0, 1).getTime(), to: new Date(2027, 0, 1).getTime() - 1 };

test('a year report keeps currencies apart and adds up like the Bankroll tab', () => {
  const r = buildReport({ sessions: list, transfers: tx, bankrolls: brs, range: year });
  assert.deepEqual(r.currencies.map((c) => c.currency), ['€', '$']);
  const eur = r.currencies[0];
  assert.equal(eur.totals.sessions, 3, 'the 2025 session stays out');
  assert.equal(eur.totals.profit, 100 - 100 + 750);
  assert.equal(eur.deposits, 1000);
  assert.deepEqual([eur.cash.sessions, eur.mtt.sessions, eur.mtt.cashes], [2, 1, 1]);
  assert.deepEqual(eur.byMonth.map((b) => b.key), ['2026-01', '2026-02', '2026-03']);
  assert.equal(eur.byVenue.length, 2);
  assert.equal(r.currencies[1].totals.profit, 300);
});

test('one bankroll only', () => {
  const r = buildReport({ sessions: list, transfers: tx, bankrolls: brs, range: year, scope: { bankrollId: 'trip' } });
  assert.equal(r.scopeName, 'Vegas');
  assert.deepEqual(r.currencies.map((c) => c.currency), ['$']);
  assert.equal(r.currencies[0].deposits, 0);
});

test('the PDF page escapes names and shows the result', () => {
  const html = reportHtml(buildReport({ sessions: list, transfers: tx, bankrolls: brs, range: year }), { player: 'Rui & <co>', now: at(9, 17) });
  assert.match(html, /Main &lt;Event&gt;/);
  assert.match(html, /Rui &amp; &lt;co&gt;/);
  assert.doesNotMatch(html, /<Event>/);
  assert.match(html, /\+750€/);
  assert.match(html, /Em \$/);
});

test('hands CSV has hero spot, cards and result', () => {
  const h = { ...sampleHand('h1'), createdAt: at(0, 1), notes: 'tanked, "snap"', shareId: 'abc' };
  const csv = handsCsv([h], list, year, 'https://sweatbook.poker');
  const [head, row] = csv.trim().split('\n');
  assert.ok(head.startsWith('date,time,type,game'));
  assert.match(row, /^2026-01-01,20:00,/);
  assert.match(row, /"tanked, ""snap"""/);
  assert.match(row, /https:\/\/sweatbook\.poker\/h\/abc$/);
  const net = replay(h).result?.net[h.hero];
  if (net !== undefined) assert.ok(row.includes(',' + String(Math.round(net * 100) / 100) + ','));
  assert.equal(handsCsv([h], list, { from: at(5, 1) }).trim().split('\n').length, 1, 'outside the range: header only');
});

test('the PDF page uses singular counts and two-digit days', () => {
  const html = reportHtml(buildReport({ sessions: list, transfers: tx, bankrolls: brs, range: year }), { now: at(9, 17) });
  assert.match(html, /Cash: 2 sessões, .*Torneios: 1 entrada, .*, 1 prémio,/);
  assert.match(html, /03\/02\/2026/);
  assert.doesNotMatch(html, /[^\d]3\/02\/2026/);
});

test('trips in the range get their own table, after expenses, and expenses go to the CSV', () => {
  const vegas: Trip = {
    id: 'v', name: 'Vegas <WSOP>', venue: 'Bellagio', currency: '$', from: at(5, 1) - 20 * 3600000, to: at(5, 4), fx: { currency: '€', rate: 0.9 },
    expenses: [{ id: 'e', kind: 'hotel', amount: 200, currency: '$', at: at(5, 2), note: '3 nights' }], createdAt: 0,
  };
  const r = buildReport({ sessions: list, transfers: tx, bankrolls: brs, range: year, trips: [vegas, { ...vegas, id: 'old', from: 0, to: 1 }] });
  assert.deepEqual(r.trips.map((x) => x.trip.id), ['v']);
  assert.equal(r.trips[0].summary.net, 300 - 200);
  const html = reportHtml(r, { now: at(11, 31) });
  assert.ok(html.includes('Vegas &lt;WSOP&gt;'));
  const csv = sessionsCsv([], brs, [], [{ trip: vegas, x: vegas.expenses[0] }]).trim().split('\n');
  assert.equal(csv.length, 2);
  assert.ok(csv[1].startsWith(`${dayKey(at(5, 2))},,expense,`), csv[1]);
  assert.ok(csv[1].includes(',-200,'));
  assert.ok(csv[1].endsWith('hotel: 3 nights'));
});

test('a multi-day tournament row says its day and when it is in the bag', () => {
  const s = sess('md', { kind: 'mtt', name: 'Main Event Multi', day: 2, bag: { stack: 154000, at: at(0, 2) }, buyIn: 600 });
  const html = reportHtml(buildReport({ sessions: [s], transfers: [], bankrolls: [], range: year }));
  assert.ok(html.includes('Main Event Multi <span class="muted">· Dia 2 · no saco</span>'), 'day and bag on the row');
});

test('the report says when results include swaps', () => {
  const plain = reportHtml(buildReport({ sessions: [sess('a', {})], transfers: [], bankrolls: [], range: year }));
  assert.ok(!plain.includes('inclui swaps'));
  const html = reportHtml(buildReport({ sessions: [sess('b', { swapNet: 120 })], transfers: [], bankrolls: [], range: year }));
  assert.ok(html.includes('inclui swaps'));
});
