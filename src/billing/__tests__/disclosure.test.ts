/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LEGAL, legalUrl, offerMonths, pctOff } from '../disclosure';

test('legal pages open at the player language section', () => {
  assert.equal(legalUrl('terms', 'en'), LEGAL.terms);
  assert.equal(legalUrl('terms', 'pt-PT'), `${LEGAL.terms}#pt`);
  assert.equal(legalUrl('privacy', 'pt-BR'), `${LEGAL.privacy}#pt-br`);
  assert.equal(legalUrl('privacy', 'es'), `${LEGAL.privacy}#es`);
});

test('legal links point at the pages served from web/public', () => {
  assert.equal(LEGAL.terms, 'https://sweatbook.poker/terms.html');
  assert.equal(LEGAL.privacy, 'https://sweatbook.poker/privacy.html');
});

test('offer length in months comes from the store period', () => {
  // App Store promotional offer: 3 periods of 1 month.
  assert.equal(offerMonths('MONTH', 1, 3), 3);
  // Google Play phase: P1M billed 3 times; or one P3M phase.
  assert.equal(offerMonths('MONTH', 3, 1), 3);
  assert.equal(offerMonths('YEAR', 1, 1), 12);
});

test('an offer the store does not give in months has no month count', () => {
  assert.equal(offerMonths('WEEK', 1, 4), null);
  assert.equal(offerMonths('DAY', 3, 1), null);
  assert.equal(offerMonths('MONTH', 1, null), null);
  assert.equal(offerMonths('MONTH', 0, 3), null);
  assert.equal(offerMonths(undefined, 1, 3), null);
});

test('percent off only between two real prices', () => {
  assert.equal(pctOff(29.99, 17.99), 40);
  assert.equal(pctOff(undefined, 17.99), null);
  assert.equal(pctOff(29.99, null), null);
  // Not a discount: no "−0%" or a negative one.
  assert.equal(pctOff(29.99, 29.99), null);
  assert.equal(pctOff(29.99, 39.99), null);
});
