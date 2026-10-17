/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chipChop, icm } from '../icm';

const close = (a: number[], b: number[], eps = 0.01) => a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < eps, `${x} vs ${b[i]}`));

test('equal stacks split evenly', () => {
  close(icm([100, 100, 100], [50, 30, 20]), [33.33, 33.33, 33.33]);
});

test('known 3-handed ICM', () => {
  // Stacks 50/30/20, payouts 50/30/20 (worked by hand).
  close(icm([5000, 3000, 2000], [50, 30, 20]), [38.393, 32.75, 28.857], 0.01);
});

test('heads-up ICM is chip-proportional above 2nd', () => {
  close(icm([3000, 1000], [100, 60]), [90, 70]);
});

test('equities always sum to the prize pool', () => {
  const e = icm([12000, 8000, 5000, 3000, 2000], [1000, 600, 400, 250, 150]);
  assert.ok(Math.abs(e.reduce((a, b) => a + b, 0) - 2400) < 1e-6);
});

test('chip chop locks the lowest payout', () => {
  close(chipChop([3000, 1000], [100, 60]), [90, 70]);
  close(chipChop([500, 300, 200], [500, 300, 200]), [200 + 400 * 0.5, 200 + 400 * 0.3, 200 + 400 * 0.2]);
});
