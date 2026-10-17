/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitFont } from '../fit-text';

test('short numbers keep their size', () => {
  assert.equal(fitFont('+2 400 €', 64, 308, { letterSpacing: -2 }), 64);
});

test('a result with cents shrinks to fit the card instead of being cut', () => {
  const s = fitFont('+1 229 267,39 €', 64, 308, { letterSpacing: -2 });
  assert.ok(s < 64);
  assert.ok(15 * s * (0.6 - 2 / 64) <= 308);
});

test('never below the floor, never above the base', () => {
  assert.equal(fitFont('x'.repeat(200), 30, 100), 9);
  assert.equal(fitFont('1', 30, 1000), 30);
  assert.equal(fitFont('', 30, 100), 30);
});
