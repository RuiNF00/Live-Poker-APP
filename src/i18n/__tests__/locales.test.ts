/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { check } from '../../../scripts/i18n-missing';
import { resolve, translate } from '..';

// The full list, file by file: npm run i18n:missing
const report = check();

test('every string has Spanish text', () => {
  assert.deepEqual(report.es.missing, []);
});

test('every string that reads differently in Brazil has pt-BR text', () => {
  assert.deepEqual(report['pt-BR'].missing, []);
});

test('translations keep their {placeholders} and avoid store-banned words', () => {
  for (const r of Object.values(report)) {
    assert.deepEqual(r.placeholders, []);
    assert.deepEqual(r.banned, []);
  }
});

test('the device language picks the variant', () => {
  assert.equal(resolve([{ languageCode: 'pt', regionCode: 'BR', languageTag: 'pt-BR' }]).variant, 'pt-BR');
  assert.equal(resolve([{ languageCode: 'pt', regionCode: 'PT', languageTag: 'pt-PT' }]).variant, 'pt-PT');
  assert.equal(resolve([{ languageCode: 'pt', regionCode: 'AO' }]).variant, 'pt-PT');
  assert.equal(resolve([{ languageCode: 'pt', regionCode: null, languageTag: 'pt-BR' }]).variant, 'pt-BR');
  assert.equal(resolve([{ languageCode: 'es', regionCode: 'MX', languageTag: 'es-MX' }]).variant, 'es');
  assert.equal(resolve([{ languageCode: 'fr' }, { languageCode: 'es' }]).variant, 'es');
  assert.equal(resolve([{ languageCode: 'fr' }]).variant, 'en');
  assert.equal(resolve([]).variant, 'pt-PT');
});

test('missing text falls back to the closest language', () => {
  assert.equal(translate('pt-BR', 'Mão'), 'Mão');
  assert.equal(translate('es', 'Uma frase que não existe'), 'Uma frase que não existe');
  assert.equal(translate('pt-PT', 'Guardar'), 'Guardar');
  assert.equal(translate('en', 'Guardar'), 'Save');
});
