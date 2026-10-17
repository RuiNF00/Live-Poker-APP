/// <reference types="node" />
// Files the way people really have them: exported by hand from Excel or
// Google Sheets, in Portuguese and American formats, with junk rows.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { profit } from '../../store/session-math';
import { prepare, toSessions } from '../convert';

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
