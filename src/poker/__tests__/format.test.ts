/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FORMAT, locale } from '../../i18n';
import { chips, compactMoney, pct, rawMoney, shortDate, timeOf } from '../format';

test('cached formatters print exactly what toLocaleString printed', () => {
  const amounts = [0, 1, 7.5, 12.25, 950, 999.99, 1000, 1234.5, 9999, -42, -1234.56, 250000, 1e6];
  for (const n of amounts) {
    const a = Math.abs(n);
    // Whole chips print as integers; cent games (0,25/0,50) keep their cents.
    const whole = Number.isInteger(a);
    if (a < 10000)
      assert.equal(chips(n), (n < 0 ? '-' : '') + (whole ? Math.round(a).toLocaleString(locale) : a.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).replace(/\s/g, ' '));
    const cents = Math.round(a * 100);
    const s = cents % 100 === 0 ? (cents / 100).toLocaleString(locale) : (cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    assert.ok(rawMoney(n, '€').includes(s), `${n}: ${rawMoney(n, '€')} vs ${s}`);
  }
  for (const [x, d] of [[0.847, 1], [0.5, 0], [0.12345, 2], [1, 0]] as const)
    assert.equal(pct(x, d), (x * 100).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d }) + '%');
  for (const ts of [0, 1760000000000, 1767225599000, Date.UTC(2026, 11, 3, 21, 5)]) {
    assert.equal(shortDate(ts), new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: 'short' }));
    assert.equal(timeOf(ts), new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
  }
});

test('cent blinds and chops keep their cents: 0,25/0,50 and 0,63, never 0/1 and 1', () => {
  const sep = (0.5).toLocaleString(locale).includes(',') ? ',' : '.';
  assert.equal(chips(0.25), `0${sep}25`);
  assert.equal(chips(0.5), `0${sep}50`);
  assert.equal(chips(0.63), `0${sep}63`);
  assert.equal(chips(5), '5');
});

test('big stacks roll over to the next unit instead of "1000k" or "1000000M"', () => {
  const sep = FORMAT.decimalComma ? ',' : '.';
  assert.equal(chips(12500), `12${sep}5k`);
  assert.equal(chips(999999), '1M');
  assert.equal(chips(1250000), `1${sep}25M`);
  assert.equal(chips(999999999), '1B');
  assert.equal(chips(2.5e9), `2${sep}5B`);
  assert.equal(chips(-12345678901), `-12${sep}35B`);
  assert.equal(chips(999999999999), '1T');
  assert.equal(chips(4.2e15), '4200T');
  assert.ok(compactMoney(999999999999, '€').includes('1T'));
});
