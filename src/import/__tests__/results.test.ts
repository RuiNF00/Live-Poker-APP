/// <reference types="node" />
// Tournament results the way players paste them: a results table copied from a browser
// (tabs, a second column with the prize in dollars), one cell per line from a phone,
// lines typed by hand, a sheet saved with semicolons. Only cashes; money is never guessed.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../../store/types';
import { likelyDuplicates } from '../duplicates';
import { cashSessions, parseResults, totalsByCurrency, type ResultRow } from '../results';

const day = (r: ResultRow) => {
  const d = new Date(r.at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const pick = (r: ResultRow) => ({ day: day(r), finish: r.finish, prize: r.prize, currency: r.currency, buyIn: r.buyIn });

// A database results table copied from a desktop browser: date, venue, event, place, prize, prize in dollars.
const DATABASE = [
  'Date\tEvent\tPlace\tPrize',
  "07-Jul-2024\tHorseshoe & Paris Las Vegas, Las Vegas\t$1,500 No Limit Hold'em - Millionaire Maker (Event #29)\t123rd\t$7,423\t$7,423",
  '14-Apr-2024\tEPT Monte Carlo\t€5,300 Main Event\t45th\t€24,500\t$26,410',
  '02-Feb-2024\tWPT Prime, Nottingham\tHigh Roller\t3rd\t£12,000\t$15,100',
  '21-Nov-2023\tWSOP Circuit, Hammond\t$400 Monster Stack\t1st\t$52,185\t$52,185',
].join('\n');

test('a results table from a desktop browser: event, venue, place, prize in its own currency, buy-in from the name', () => {
  const p = parseResults(DATABASE);
  assert.equal(p.rows.length, 4);
  assert.deepEqual(p.skipped, []);
  assert.deepEqual(pick(p.rows[0]), { day: '2024-07-07', finish: 123, prize: 7423, currency: '$', buyIn: 1500 });
  assert.equal(p.rows[0].name, "$1,500 No Limit Hold'em - Millionaire Maker (Event #29)");
  assert.equal(p.rows[0].venue, 'Horseshoe & Paris Las Vegas, Las Vegas');
  // The second amount is the page's conversion to dollars, never the prize.
  assert.deepEqual(pick(p.rows[1]), { day: '2024-04-14', finish: 45, prize: 24500, currency: '€', buyIn: 5300 });
  // No amount in the name: the buy-in is left for the player.
  assert.deepEqual(pick(p.rows[2]), { day: '2024-02-02', finish: 3, prize: 12000, currency: '£', buyIn: undefined });
  assert.equal(p.rows[2].name, 'High Roller');
  assert.deepEqual(pick(p.rows[3]), { day: '2023-11-21', finish: 1, prize: 52185, currency: '$', buyIn: 400 });
});

test('a phone copies each cell onto its own line: the lines after a date are that row', () => {
  const text = ['07 Jul 2024', "$1,500 No-Limit Hold'em Millionaire Maker", '123rd', '$7,423', '', 'Jul 8, 2024', '$600 Deepstack', '9th', '$2,100', '$2,100'].join('\n');
  const p = parseResults(text);
  assert.deepEqual(p.rows.map(pick), [
    { day: '2024-07-07', finish: 123, prize: 7423, currency: '$', buyIn: 1500 },
    { day: '2024-07-08', finish: 9, prize: 2100, currency: '$', buyIn: 600 },
  ]);
  assert.equal(p.rows[1].name, '$600 Deepstack');
  assert.equal(p.rows[1].line, 6);
  assert.deepEqual(p.skipped, []);
});

test('lines typed by hand in English: ordinals, "of" the field, fee after a plus, a guarantee that is not the buy-in', () => {
  const text = [
    'Jul 7th, 2024 - $1,500 NLH Event #34 - 1st of 2,345 - $345,000',
    '2024-03-02 $3,500 Main Event $1,000,000 GTD 22nd $18,400',
    '2024-03-09 €500+50 Deepstack 111th €1,100',
    '2024-03-10 $250 Turbo 2nd (812 entries) $9,875',
    '2024-03-11 $1,100 2nd Chance 21st $2,300',
  ].join('\n');
  const p = parseResults(text);
  assert.deepEqual(p.rows.map(pick), [
    { day: '2024-07-07', finish: 1, prize: 345000, currency: '$', buyIn: 1500 },
    { day: '2024-03-02', finish: 22, prize: 18400, currency: '$', buyIn: 3500 },
    { day: '2024-03-09', finish: 111, prize: 1100, currency: '€', buyIn: 550 },
    { day: '2024-03-10', finish: 2, prize: 9875, currency: '$', buyIn: 250 },
    // "2nd Chance" is the event's name; the place is the last ordinal.
    { day: '2024-03-11', finish: 21, prize: 2300, currency: '$', buyIn: 1100 },
  ]);
  assert.equal(p.rows[0].field, 2345);
  assert.equal(p.rows[0].name, '$1,500 NLH Event #34');
  assert.equal(p.rows[3].field, 812);
  assert.equal(p.rows[4].name, '$1,100 2nd Chance');
});

test('Portuguese: 5.º, 12º lugar, months by name, European amounts', () => {
  const text = [
    '12/03/2024 €550 Main Event Estoril 23.º 12.400 €',
    '3 de março de 2024 · Casino Lisboa · Torneio 250 € · 5.º lugar · 3.250,50 €',
    '2024-05-01 Main Event 12º lugar 1.234.567 €',
  ].join('\n');
  const p = parseResults(text);
  assert.deepEqual(p.rows.map(pick), [
    { day: '2024-03-12', finish: 23, prize: 12400, currency: '€', buyIn: 550 },
    { day: '2024-03-03', finish: 5, prize: 3250.5, currency: '€', buyIn: 250 },
    { day: '2024-05-01', finish: 12, prize: 1234567, currency: '€', buyIn: undefined },
  ]);
  assert.equal(p.rows[0].name, '€550 Main Event Estoril');
  assert.match(p.rows[1].name, /Torneio 250 €/);
});

test('Spanish: 1er, 2do, 3er puesto, Ganador, and a prize label', () => {
  const text = [
    '15/06/2023 CEP Madrid 300 € Main Event 1er 21.000 €',
    '16/06/2023 CEP Madrid 150 € Turbo 2do premio 4.500 €',
    '17/06/2023 Torneo Diario 100 € 3er puesto 1.250 €',
    '18/06/2023 Copa 50 € Ganador 900 €',
  ].join('\n');
  const p = parseResults(text);
  assert.deepEqual(p.rows.map((r) => [r.finish, r.prize, r.buyIn]), [
    [1, 21000, 300],
    [2, 4500, 150],
    [3, 1250, 100],
    [1, 900, 50],
  ]);
  assert.equal(p.order, 'dmy');
  assert.equal(p.rows[0].name, 'CEP Madrid 300 € Main Event');
});

test('a sheet with semicolons and its own columns, buy-in column included', () => {
  const text = ['Data;Torneio;Local;Lugar;Prémio;Buy-in', '12/03/2024;Main Event;Casino Estoril;23;12.400 €;550 €', '13/03/2024;Turbo;Casino Estoril;4;1.980,50 €;', '14/03/2024;Freeroll;Casino Estoril;1;300 €;0'].join('\n');
  const p = parseResults(text);
  assert.deepEqual(p.rows.map(pick), [
    { day: '2024-03-12', finish: 23, prize: 12400, currency: '€', buyIn: 550 },
    { day: '2024-03-13', finish: 4, prize: 1980.5, currency: '€', buyIn: undefined },
    // A buy-in of 0 written in the sheet is a freeroll, not a missing one.
    { day: '2024-03-14', finish: 1, prize: 300, currency: '€', buyIn: 0 },
  ]);
  assert.deepEqual([p.rows[0].name, p.rows[0].venue], ['Main Event', 'Casino Estoril']);
});

test('a CSV with commas reads quoted amounts; a currency column names the currency of bare numbers', () => {
  const text = ['Date,Event,Place,Prize,Currency', '2024-03-12,"$1,500 NLH",23,"12,400",USD', '2024-03-13,PLO,5,"3,200",CAD'].join('\n');
  const p = parseResults(text);
  assert.deepEqual(p.rows.map(pick), [
    { day: '2024-03-12', finish: 23, prize: 12400, currency: '$', buyIn: 1500 },
    { day: '2024-03-13', finish: 5, prize: 3200, currency: 'CAD', buyIn: undefined },
  ]);
});

test('US and European numbers: 1,234,567.89, 1.234.567,89, 12 400 € and 1.5k', () => {
  const text = ['2024-01-05 $5,000 High Roller 2nd $1,234,567.89', '2024-01-06 €2,000 Event 3rd 1.234.567,89 €', '2024-01-07 Event 4th 12 400 €', '2024-01-08 $200 Daily 1st $1.5k'].join('\n');
  assert.deepEqual(
    parseResults(text).rows.map((r) => r.prize),
    [1234567.89, 1234567.89, 12400, 1500],
  );
});

test('mixed currencies stay apart: each row keeps its own and totals never add them up', () => {
  const p = parseResults(DATABASE);
  const totals = totalsByCurrency(p.rows, { currency: '€' });
  assert.deepEqual(totals, [
    { currency: '$', rows: 2, prizes: 59608, buyIns: 1900, withBuyIn: 2 },
    { currency: '£', rows: 1, prizes: 12000, buyIns: 0, withBuyIn: 0 },
    { currency: '€', rows: 1, prizes: 24500, buyIns: 5300, withBuyIn: 1 },
  ]);
  // A buy-in typed for the pound row counts in pounds only.
  const typed = totalsByCurrency(p.rows, { currency: '€', buyIns: { [p.rows[2].line]: 1100 } });
  assert.deepEqual(typed.find((x) => x.currency === '£'), { currency: '£', rows: 1, prizes: 12000, buyIns: 1100, withBuyIn: 1 });
});

test('a buy-in in another currency than the prize is not used: it could be a conversion', () => {
  const p = parseResults('2024-04-14 EPT Monte Carlo $5,800 Main Event 45th €24,500');
  assert.equal(p.rows[0].currency, '€');
  assert.equal(p.rows[0].buyIn, undefined);
});

test('rows without a buy-in wait for the player: typed one by one or in bulk, never made up', () => {
  const p = parseResults(DATABASE);
  const first = cashSessions(p.rows, { currency: '€', tableSize: 9 });
  assert.equal(first.sessions.length, 3);
  assert.deepEqual(first.waiting.map((r) => r.name), ['High Roller']);
  const typed = cashSessions(p.rows, { currency: '€', tableSize: 9, buyIns: { [p.rows[2].line]: 1100 } });
  assert.equal(typed.sessions.length, 4);
  assert.equal(typed.waiting.length, 0);
  const s = typed.sessions.find((x) => x.name === 'High Roller')!;
  assert.deepEqual([s.buyIn, s.cashOut, s.currency, s.finish, s.kind, s.entries], [1100, 12000, '£', 3, 'mtt', 1]);
  // A typed buy-in wins over the one read from the name.
  const over = cashSessions(p.rows, { currency: '€', tableSize: 9, buyIns: { [p.rows[0].line]: 1600 } });
  assert.equal(over.sessions.find((x) => x.cashOut === 7423)!.buyIn, 1600);
});

test('every session is marked as from a results list, live, with no hours played', () => {
  const { sessions } = cashSessions(parseResults(DATABASE).rows, { currency: '€', tableSize: 9 });
  for (const s of sessions) {
    assert.equal(s.cashList, true);
    assert.equal(s.format, undefined);
    assert.equal(s.endedAt, s.startedAt);
    assert.match(s.id, /^imr_/);
  }
});

test('the same list pasted twice gives the same sessions, so the second adds nothing', () => {
  const a = cashSessions(parseResults(DATABASE).rows, { currency: '€', tableSize: 9 }).sessions.map((s) => s.id);
  const b = cashSessions(parseResults(DATABASE + '\n').rows, { currency: '€', tableSize: 9 }).sessions.map((s) => s.id);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
});

test('two pages that overlap: a result pasted twice in one text is left out once, and said', () => {
  const line = '2024-03-12 €550 Main Event 23rd €12.400';
  const p = parseResults([line, '2024-03-13 €220 Turbo 4th €1.980', line].join('\n'));
  assert.equal(p.rows.length, 2);
  assert.deepEqual(p.skipped, [{ line: 3, reason: 'repeat', value: line }]);
});

test('a result already logged here (re-entries and all) is a likely repeat; another prize or a week away is not', () => {
  const at = (d: string) => new Date(d).getTime();
  const have = [
    // Day 1 bought twice, the prize on Day 2: the results page says one entry and the final day.
    { id: 'mine', kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: at('2024-03-11T16:00'), breaks: [], buyIn: 550, entries: 2, addOn: 0, cashOut: 12400 } as unknown as Session,
  ];
  const rows = parseResults(['2024-03-12 €550 Main Event 23rd €12.400', '2024-03-12 €550 Main Event 24th €12.000', '2024-03-20 €550 Main Event 23rd €12.400'].join('\n')).rows;
  const { sessions } = cashSessions(rows, { currency: '€', tableSize: 9 });
  const dups = likelyDuplicates(sessions, have, { amount: (s) => s.cashOut, days: 3 });
  assert.deepEqual([...dups.values()].map((s) => s.id), ['mine']);
  assert.equal(dups.has(sessions[0].id), true);
  // The CSV rule (whole action, same day) would not have seen it.
  assert.equal(likelyDuplicates(sessions, have).size, 0);
});

test('lines with no full date or no prize are listed; a header, totals and page text are not', () => {
  const text = [
    'Live tournament results',
    'Date Event Place Prize',
    'Total live earnings: $1,234,567',
    '2024 $1,500 NLH 23rd $12,400',
    '2024-03-12 €550 Main Event 23rd',
    '2024-03-13 €220 Turbo 4th €1.980',
    'Show more',
  ].join('\n');
  const p = parseResults(text);
  assert.equal(p.rows.length, 1);
  assert.deepEqual(
    p.skipped.map((s) => [s.line, s.reason]),
    [
      [4, 'noDate'],
      [5, 'noPrize'],
    ],
  );
});

test('dd/mm or mm/dd: the dates decide, then dollars mean an American page; an override wins', () => {
  // 25/03 can only be day first.
  assert.equal(parseResults('25/03/2024 €550 Main 23rd €1.200\n03/04/2024 €220 Turbo 4th €900').order, 'dmy');
  const us = parseResults('03/04/2024 $600 Deepstack 9th $2,100');
  assert.equal(us.order, 'mdy');
  assert.equal(us.ambiguousDates, true);
  assert.equal(day(us.rows[0]), '2024-03-04');
  const eu = parseResults('03/04/2024 €600 Deepstack 9th €2.100');
  assert.equal(day(eu.rows[0]), '2024-04-03');
  assert.equal(day(parseResults('03/04/2024 $600 Deepstack 9th $2,100', { order: 'dmy' }).rows[0]), '2024-04-03');
});

test('a weekday in front, two-digit years, ISO dates', () => {
  const p = parseResults(['Sat, Oct 17 2026 $1,100 Main 5th $8,000', 'sáb. 17 out 2026 €300 Daily 2.º €1.500', '17.10.26 €300 Daily 3.º €1.000'].join('\n'));
  assert.deepEqual(p.rows.map(day), ['2026-10-17', '2026-10-17', '2026-10-17']);
});

test('no currency anywhere: the prize is the number after the place, its currency the player picks', () => {
  const p = parseResults('2024-03-12 Main Event 23rd 12,400\n2024-03-13 Turbo 4th 980');
  assert.deepEqual(p.rows.map((r) => [r.prize, r.currency]), [
    [12400, undefined],
    [980, undefined],
  ]);
  const { sessions } = cashSessions(p.rows, { currency: '$', tableSize: 9, buyIns: { [p.rows[0].line]: 1100, [p.rows[1].line]: 120 } });
  assert.deepEqual(sessions.map((s) => s.currency), ['$', '$']);
});

test('a place without its ordinal, just before the prize, still reads; "Event 23" is the event', () => {
  const p = parseResults('2024-02-02 Event #12 NLH 23 €5,000');
  assert.deepEqual([p.rows[0].finish, p.rows[0].prize], [23, 5000]);
  assert.equal(p.rows[0].name, 'Event #12 NLH');
  const ev = parseResults('2024-02-02 Main Event 23 €5,000').rows[0];
  assert.deepEqual([ev.finish, ev.prize], [undefined, 5000]);
});

test('place and field as 23/456, other currencies by symbol and code', () => {
  const p = parseResults(['2024-01-10 C$1,100 Main 23/456 C$4,200', '2024-01-11 A$1,150 Main 7th A$9,000', '2024-01-12 Main Event 3rd CHF 12,000', '2024-01-13 R$ 1.100 Main 9.º R$ 15.400'].join('\n'));
  assert.deepEqual(p.rows.map((r) => [r.currency, r.prize, r.buyIn]), [
    ['CAD', 4200, 1100],
    ['A$', 9000, 1150],
    ['CHF', 12000, undefined],
    ['R$', 15400, 1100],
  ]);
  assert.equal(p.rows[0].field, 456);
  assert.equal(p.rows[0].finish, 23);
});

test('empty or unrelated text gives nothing and no crash', () => {
  assert.deepEqual(parseResults('').rows, []);
  assert.deepEqual(parseResults('hello\nworld').rows, []);
  assert.deepEqual(parseResults('﻿\r\n\r\n').skipped, []);
});
