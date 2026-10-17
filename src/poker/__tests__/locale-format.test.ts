/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { localeFormat } from '../../i18n';
import { storedCurrency } from '../../store/currencies';
import { bbs, chips, moneyIn, rawCompactMoney } from '../format';

// U+00A0, so "R$" never wraps away from its amount.
const NB = ' ';
const money = (v: Parameters<typeof localeFormat>[0], n: number, cur: string, tag?: string) => moneyIn(localeFormat(v, tag), n, cur);

test('money reads the way each language writes it', () => {
  assert.equal(money('pt-PT', 370, '€'), '370€');
  assert.equal(money('pt-PT', 1234.5, '€'), '1234,50€');
  assert.equal(money('pt-PT', 12.5, '€'), '12,50€');
  // Portugal and Spain group thousands only from 5 digits: 2500€, 12 345€ (CLDR, RAE).
  assert.equal(money('pt-PT', 12345, '€'), `12${NB}345€`);
  assert.equal(money('pt-BR', 1234.56, 'R$'), `R$${NB}1.234,56`);
  assert.equal(money('pt-BR', 12.5, 'R$'), `R$${NB}12,50`);
  assert.equal(money('pt-BR', -370, 'R$'), `−R$${NB}370`);
  assert.equal(money('es', 12.5, '€', 'es-ES'), `12,50${NB}€`);
  assert.equal(money('es', 12345, '€', 'es-ES'), `12.345${NB}€`);
  assert.equal(money('es', 12.5, '$', 'es-MX'), '$12.50');
  assert.equal(money('es', 12345, 'MX$', 'es-MX'), 'MX$12,345');
  assert.equal(money('en', 1234.56, '$'), '$1,234.56');
  assert.equal(money('en', 12.5, '£'), '£12.50');
});

test('money keeps its cents from 1000 up; whole amounts stay clean', () => {
  // A backer is owed 3744,33, not 3744: staking, swaps, bankroll and «Enviar contas» all print this.
  assert.equal(money('pt-PT', 1000.5, '€'), '1000,50€');
  assert.equal(money('pt-PT', 3744.33, '$'), '3744,33$');
  assert.equal(money('pt-PT', 12345.67, '€'), `12${NB}345,67€`);
  assert.equal(money('pt-PT', 1250, '€'), '1250€');
  assert.equal(money('pt-PT', 12346, '€'), `12${NB}346€`);
  assert.equal(money('pt-PT', -3976.67, '€'), '−3976,67€');
  assert.equal(money('pt-BR', 1000.5, 'R$'), `R$${NB}1.000,50`);
  assert.equal(money('pt-BR', 3744.33, 'R$'), `R$${NB}3.744,33`);
  assert.equal(money('pt-BR', 12345.67, 'R$'), `R$${NB}12.345,67`);
  assert.equal(money('pt-BR', 1250, 'R$'), `R$${NB}1.250`);
  assert.equal(money('es', 1000.5, '€', 'es-ES'), `1000,50${NB}€`);
  assert.equal(money('es', 3744.33, '€', 'es-ES'), `3744,33${NB}€`);
  assert.equal(money('es', 12345.67, '€', 'es-ES'), `12.345,67${NB}€`);
  assert.equal(money('es', 1250, '€', 'es-ES'), `1250${NB}€`);
  assert.equal(money('en', 1000.5, '$'), '$1,000.50');
  assert.equal(money('en', 3744.33, '$'), '$3,744.33');
  assert.equal(money('en', 12345.67, '$'), '$12,345.67');
  assert.equal(money('en', 1250, '$'), '$1,250');
  // No cents in yen, whatever the amount.
  assert.equal(money('en', 3744.33, 'JPY'), '¥3,744');
});

test('decimal separator and Intl tag per language', () => {
  assert.deepEqual(
    (['pt-PT', 'pt-BR', 'en'] as const).map((v) => [localeFormat(v).locale, localeFormat(v).decimalComma]),
    [['pt-PT', true], ['pt-BR', true], ['en-GB', false]],
  );
  assert.equal(localeFormat('es').locale, 'es-ES');
  assert.equal(localeFormat('es', 'es-MX').decimalComma, false);
  assert.equal(localeFormat('es', 'es-AR').decimalComma, true);
  // Argentina writes 1.234,50 but puts the symbol first.
  assert.equal(localeFormat('es', 'es-AR').currencyAfter, false);
});

test('short chip and bb amounts use the local decimal', () => {
  // Tests run as pt-PT, which writes a decimal comma.
  assert.equal(chips(12500), '12,5k');
  assert.equal(chips(1250000), '1,25M');
  assert.equal(bbs(500, 200), '2,5 bb');
  assert.equal(bbs(4000, 200), '20 bb');
});

test('compact money keeps the currency where the language puts it', () => {
  assert.equal(rawCompactMoney(2500, '€'), '2500€');
  assert.equal(rawCompactMoney(12500, '€'), '12,5k€');
  assert.equal(rawCompactMoney(-2500000, '$'), '−2,5M$');
});

test('a fresh install takes the currency of the phone region', () => {
  assert.equal(storedCurrency('BRL'), 'R$');
  assert.equal(storedCurrency('usd'), '$');
  assert.equal(storedCurrency('MXN'), 'MXN');
  assert.equal(storedCurrency('XYZ'), undefined);
  assert.equal(storedCurrency(null), undefined);
});
