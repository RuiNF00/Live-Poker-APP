/// <reference types="node" />
// Files the way people really have them: exported by hand from Excel or
// Google Sheets, in Portuguese and American formats, with junk rows.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { profit } from '../../store/session-math';
import { prepare, toSessions } from '../convert';
import { autoMap } from '../mapping';

const run = (text: string) => {
  const p = prepare(text);
  return toSessions(p.table, p.mapping, { currency: '€', tableSize: 9, source: p.source });
};
const day = (ms: number) => {
  const d = new Date(ms);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
};

test('Portuguese Excel: semicolons, decimal comma, € after the number, empty rows', () => {
  const r = run(
    [
      'Data;Local;Buy-in;Cash-out;Resultado',
      '03/02/2025;Casino Estoril;200,00 €;450,50 €;250,50 €',
      ';;;;',
      '',
      '15/02/2025;Casino Lisboa;1.200,00 €;0,00 €;-1.200,00 €',
      '28/02/2025;Póquer em casa;50;;-50',
    ].join('\r\n'),
  );
  assert.equal(r.sessions.length, 3);
  assert.equal(r.failed.length, 0);
  const [a, b, c] = r.sessions;
  assert.equal(day(a.startedAt), '2025-2-3');
  assert.equal(profit(a), 250.5);
  assert.equal(profit(b), -1200);
  assert.equal(profit(c), -50);
});

test('American Sheets: month first, $ before the number, (parentheses) for losses', () => {
  const r = run(
    [
      'Date,Location,Currency,Net',
      '"12/24/2024",Bellagio,USD,"$1,250.00"',
      '"12/26/2024",Aria,USD,"($400.00)"',
      '"1/3/2025",Wynn,USD,$0',
    ].join('\n'),
  );
  assert.equal(r.order, 'mdy');
  assert.deepEqual(r.sessions.map((s) => day(s.startedAt)), ['2024-12-24', '2024-12-26', '2025-1-3']);
  assert.deepEqual(r.sessions.map(profit), [1250, -400, 0]);
  assert.ok(r.sessions.every((s) => s.currency === '$'));
});

test('ISO dates, written months and tabs all read', () => {
  const r = run(['Date\tVenue\tProfit', '2025-03-01 20:15\tCasino Barcelona\t300', '7 mar 2025\tCasino Barcelona\t-80', 'Mar 9, 2025\tCasino Barcelona\t+1.5k'].join('\n'));
  assert.deepEqual(r.sessions.map((s) => day(s.startedAt)), ['2025-3-1', '2025-3-7', '2025-3-9']);
  assert.equal(new Date(r.sessions[0].startedAt).getHours(), 20);
  assert.deepEqual(r.sessions.map(profit), [300, -80, 1500]);
});

test('rows that fail say which line and why, and the rest still import', () => {
  const r = run(
    [
      'Date,Venue,Profit',
      '01/04/2025,Estoril,120',
      '31/02/2025,Estoril,50', // no such day
      ',Estoril,90', // no date
      '05/04/2025,Estoril,n/a', // no money
      'Totals,,160',
      '06/04/2025,Estoril,-30',
    ].join('\n'),
  );
  assert.equal(r.sessions.length, 2);
  assert.deepEqual(
    r.failed.map((f) => [f.line, f.reason]),
    [
      [3, 'badDate'],
      [4, 'noDate'],
      [5, 'noMoney'],
      [6, 'badDate'],
    ],
  );
  assert.equal(r.failed[0].value, '31/02/2025');
  assert.equal(r.unreadable, 4);
});

test('line numbers skip the blank lines and the title above the header', () => {
  const r = run(['My poker 2025', '', 'Date,Venue,Profit', '', '01/04/2025,Estoril,120', 'soon,Estoril,5'].join('\n'));
  assert.equal(r.sessions.length, 1);
  assert.deepEqual(r.failed, [{ line: 6, reason: 'badDate', value: 'soon' }]);
});

test('tips and hands get their own fields, and the result still lands on the file', () => {
  const r = run(['Date,Venue,Buy-in,Cash-out,Tips,Hands,Profit', '01/05/2025,Estoril,300,520,20,210,200'].join('\n'));
  const s = r.sessions[0];
  assert.equal(s.tips, 20);
  assert.equal(s.handsDealt, 210);
  assert.equal(s.expenses, undefined);
  assert.equal(profit(s), 200);
});

test('an amount written in words is listed as left out, not read as 0; n/a and - are just empty', () => {
  const r = run(['Data;Local;Buy-in;Cash-out', '03/02/2025;Estoril;cem;300', '04/02/2025;Estoril;200;n/a', '05/02/2025;Estoril;200;-'].join('\n'));
  assert.deepEqual(r.failed, [{ line: 2, reason: 'badMoney', value: 'cem' }]);
  assert.equal(r.sessions.length, 2);
});

test('blinds written only in the game column are read for cash, not for tournaments', () => {
  const r = run(['Date,Type,Game,Buy-in,Cash-out', '2025-02-03,cash,NLH 1/2,200,300', '2025-02-04,tournament,Dia 1/2,100,0'].join('\n'));
  assert.deepEqual([r.sessions[0].sb, r.sessions[0].bb], [1, 2]);
  assert.equal(r.sessions[1].bb, 0);
});

test('dates Excel left as serial numbers are read, the fraction as the time of day', () => {
  const r = run(['Date,Venue,Buy-in,Cash-out', '45689,Estoril,100,250', '45690.75,Estoril,100,50'].join('\n'));
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.sessions.map((s) => day(s.startedAt)), ['2025-2-1', '2025-2-2']);
  assert.equal(new Date(r.sessions[1].startedAt).getHours(), 18);
});

test('ISO dates with a space before the offset, and German dates with a dot and a month name', () => {
  const r = run(['Date,Venue,Buy-in,Cash-out', '2025-02-03 20:00:00 +01:00,Estoril,100,250', '4. Mrz 2025,Wien,100,50'].join('\n'));
  assert.deepEqual(r.failed, []);
  assert.equal(r.sessions[0].startedAt, Date.parse('2025-02-03T19:00:00Z'));
  assert.equal(day(r.sessions[1].startedAt), '2025-3-4');
});

test('a German cash-out column keeps its result', () => {
  const r = run(['Datum;Ort;Buy-in;Auszahlung', '03.02.2025;Wien;100;250'].join('\n'));
  assert.equal(r.sessions.length, 1);
  assert.equal(profit(r.sessions[0]), 150);
});

test('a quote that never closes is read as text and no row after it is lost', () => {
  const r = run(['Date,Venue,Buy-in,Cash-out,Notes', '2025-02-03,Estoril,100,250,"bad note', '2025-02-04,Estoril,100,50,ok', '2025-02-05,Estoril,100,80,ok'].join('\n'));
  assert.equal(r.sessions.length, 3);
  assert.equal(r.sessions[2].notes, 'ok');
});

test('German Einsatz, Auszahlung and Gewinn: the payout is the cash-out and Gewinn the profit', () => {
  assert.deepEqual(autoMap(['Datum', 'Einsatz', 'Auszahlung', 'Gewinn']), { start: 0, buyIn: 1, cashOut: 2, profit: 3 });
  const r = run(['Datum;Einsatz;Auszahlung;Gewinn', '03.02.2025;100;300;200'].join('\n'));
  assert.equal(profit(r.sessions[0]), 200);
  // A file with only Gewinn reads it as before.
  assert.deepEqual(autoMap(['Datum', 'Einsatz', 'Gewinn']), { start: 0, buyIn: 1, cashOut: 2 });
});

test('Poker Ledger: every field quoted, cash or tournament in the format, a running session fails with its reason', () => {
  const r = run(
    [
      '"buy_in","cash_out","start_time","end_time","location","game","game_format","blinds","breaks","entrants","placed","state","note","filtered"',
      '"200","450","2018-03-04 15:17","2018-03-04 21:02","Bellagio","No Limit Hold\'em","9-max Cash Game","1/2","0","0","0","NV","good","0"',
      '"100","0","2018-03-05 12:00","2018-03-05 16:00","Aria","No Limit Hold\'em","Heads-Up Tournament","","0","45","12","NV","","0"',
      '"300","","2018-03-06 20:00","","Wynn","PLO","6-max Cash Game","2/5","0","0","0","NV","","0"',
    ].join('\n'),
  );
  assert.equal(prepare('"buy_in","cash_out","start_time","end_time","game_format","placed"\n').source, 'pokerledger');
  const [cash, mtt] = r.sessions;
  assert.deepEqual([cash.kind, cash.venue, cash.bb, profit(cash), cash.notes], ['cash', 'Bellagio', 2, 250, 'good']);
  assert.deepEqual([mtt.kind, mtt.finish, mtt.field, profit(mtt)], ['mtt', 12, 45, -100]);
  assert.deepEqual(r.failed, [{ line: 4, reason: 'running', value: '2018-03-06 20:00' }]);
});

test('no type column, but a game column that says Torneio or Cash gives the type', () => {
  const r = run(['Data;Local;Jogo;Buy-in;Cash-out', '03/02/2025;São Paulo;Torneio;100;300', '04/02/2025;Lisboa;Cash;200;100'].join('\n'));
  assert.deepEqual(r.sessions.map((s) => s.kind), ['mtt', 'cash']);
  assert.equal(r.kindKnown, true);
});

test('a row split by a line break fails as incomplete instead of saving the whole buy-in as lost', () => {
  const r = run(['Date,Type,Buy-in,Cash out,Location', '2024-03-01,Cash,100', ',250,Lisboa', '2024-03-02,Cash,50,80,Porto', '2024-03-03,Cash,50,80'].join('\n'));
  // The last row only lacks the location: still read.
  assert.deepEqual(r.sessions.map((s) => profit(s)), [30, 30]);
  assert.deepEqual(r.failed.map((f) => [f.line, f.reason]), [[2, 'short'], [3, 'short']]);
});

test('a run of digits too long for an amount fails instead of saving Infinity', () => {
  const r = run(['Date,Type,Buy-in,Cash out', `2024-03-01,Cash,${'9'.repeat(400)},200`, '2024-03-02,Cash,1000000000000,0', '2024-03-03,Cash,100,200'].join('\n'));
  assert.equal(r.sessions.length, 1);
  assert.deepEqual(r.failed.map((f) => f.reason), ['badMoney', 'badMoney']);
});

test('an end weeks after the start fails with its own reason', () => {
  const r = run(['Start,End,Type,Buy-in,Cash out', '2024-03-01 20:00,2030-01-01 00:00,Cash,100,250', '2024-07-01 12:00,2024-07-10 23:00,Torneio,1000,0', '2024-03-02 20:00,,Cash,100,250'].join('\n'));
  assert.equal(r.sessions.length, 2);
  assert.deepEqual(r.failed, [{ line: 2, reason: 'tooLong', value: '2030-01-01 00:00' }]);
});
