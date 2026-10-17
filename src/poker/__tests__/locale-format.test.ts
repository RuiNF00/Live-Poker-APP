/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { localeFormat } from '../../i18n';
import { moneyIn } from '../format';

// U+00A0, so "R$" never wraps away from its amount.
const NB = ' ';
const money = (v: Parameters<typeof localeFormat>[0], n: number, cur: string, tag?: string) => moneyIn(localeFormat(v, tag), n, cur);

test('money reads the way each language writes it', () => {
  assert.equal(money('pt-PT', 370, '€'), '370€');
  assert.equal(money('pt-PT', 1234.5, '€'), '1235€');
  assert.equal(money('pt-PT', 12.5, '€'), '12,50€');
  assert.equal(money('pt-BR', 1234.56, 'R$'), `R$${NB}1.235`);
  assert.equal(money('pt-BR', 12.5, 'R$'), `R$${NB}12,50`);
  assert.equal(money('pt-BR', -370, 'R$'), `−R$${NB}370`);
  assert.equal(money('es', 12.5, '€', 'es-ES'), `12,50${NB}€`);
  assert.equal(money('es', 12345, '€', 'es-ES'), `12.345${NB}€`);
  assert.equal(money('es', 12.5, '$', 'es-MX'), '$12.50');
  assert.equal(money('es', 12345, 'MX$', 'es-MX'), 'MX$12,345');
  assert.equal(money('en', 1234.56, '$'), '$1,235');
  assert.equal(money('en', 12.5, '£'), '£12.50');
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
