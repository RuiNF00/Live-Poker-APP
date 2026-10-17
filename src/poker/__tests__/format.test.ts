/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { locale } from '../../i18n';
import { chips, compactMoney, pct, rawMoney, shortDate, timeOf } from '../format';

test('cached formatters print exactly what toLocaleString printed', () => {
  const amounts = [0, 1, 7.5, 12.25, 950, 999.99, 1000, 1234.5, 9999, -42, -1234.56, 250000, 1e6];
  for (const n of amounts) {
    const a = Math.abs(n);
    if (a < 10000) assert.equal(chips(n), (n < 0 ? '-' : '') + Math.round(a).toLocaleString(locale).replace(/\s/g, ' '));
    const cents = Math.round(a * 100);
    const s = a >= 1000 ? Math.round(a).toLocaleString(locale) : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    assert.ok(rawMoney(n, '€').includes(s), `${n}: ${rawMoney(n, '€')} vs ${s}`);
  }
  for (const [x, d] of [[0.847, 1], [0.5, 0], [0.12345, 2], [1, 0]] as const)
    assert.equal(pct(x, d), (x * 100).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d }) + '%');
  for (const ts of [0, 1760000000000, 1767225599000, Date.UTC(2026, 11, 3, 21, 5)]) {
    assert.equal(shortDate(ts), new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: 'short' }));
    assert.equal(timeOf(ts), new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
  }
});

test('compact money: short amount, currency where money() puts it', () => {
  // Tests run in pt: the symbol after the number, like rawMoney.
  assert.equal(compactMoney(162000, '€'), '162k€');
  assert.equal(compactMoney(-315000, '$'), '−315k$');
  assert.equal(compactMoney(1_250_000, 'CHF'), chips(1_250_000) + ' CHF');
  assert.equal(compactMoney(162000, '$'), rawMoney(1, '$').replace('1', '162k'));
});
