/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chipChop, icm, icmCall, payoutPreset, pkoBountyChips, pkoRequiredEquity, riskPremiumMatrix, tablePaidPlaces } from '../icm';

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

test('payout presets sum to 1 and a satellite pays every seat the same', () => {
  for (const p of ['satellite', 'flat', 'standard', 'top'] as const)
    for (const n of [1, 3, 9, 20]) assert.ok(Math.abs(payoutPreset(p, n).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  close(payoutPreset('satellite', 4), [0.25, 0.25, 0.25, 0.25], 1e-9);
  assert.ok(payoutPreset('top', 9)[0] > payoutPreset('standard', 9)[0]);
  assert.ok(payoutPreset('flat', 9)[0] < payoutPreset('standard', 9)[0]);
});

test('winner-take-all has no risk premium: ICM equity is chips', () => {
  const r = icmCall({ stacks: [500, 500, 1000], payouts: [100], hero: 0, villain: 1, pot: 500, call: 500 });
  assert.ok(Math.abs(r.riskPremium) < 1e-9);
  assert.ok(Math.abs(r.chipEq - 0.5) < 1e-9);
});

test('on the bubble a call needs more than pot odds', () => {
  // 4 left, 3 paid: two big stacks, a short one. Calling off between the big stacks is expensive.
  const m = riskPremiumMatrix([1000, 1000, 1000, 200], [50, 30, 20]);
  assert.ok(Number.isNaN(m[0][0]));
  assert.ok(m[0][1] > 0.05, `rp ${m[0][1]}`);
  // The short stack risks little of its own equity: its premium against a big stack is smaller.
  assert.ok(m[3][0] < m[0][1]);
});

test('a busted player takes the next place down', () => {
  const r = icmCall({ stacks: [0, 0, 1000], payouts: [70, 30], hero: 0, villain: 1, pot: 1000, call: 0 });
  // Hero folds with nothing behind: villain wins the pot, hero's 0 chips take 3rd (unpaid).
  assert.equal(r.evFold, 0);
});

test('PKO: a covered bounty lowers the equity needed', () => {
  // 1 000 buy-in, 20 000 starting stack, villain's bounty 500: 500 × 0.5 × 20 = 5 000 chips.
  assert.equal(pkoBountyChips(500, 20000, 1000), 5000);
  const plain = pkoRequiredEquity(10000, 25000, 0);
  const pko = pkoRequiredEquity(10000, 25000, 5000);
  assert.equal(plain, 0.4);
  assert.ok(Math.abs(pko - 1 / 3) < 1e-9);
  assert.equal(pkoBountyChips(0, 20000, 1000), 0);
});

test('table paid places from players left of the field', () => {
  // 300 entries pay 45: one off the bubble at a 9-handed table pays 8 of them.
  assert.equal(tablePaidPlaces(9, 46, 300), 8);
  assert.equal(tablePaidPlaces(9, 50, 300), 4);
  // Far from the money, or already in it: the whole table.
  assert.equal(tablePaidPlaces(9, 100, 300), 9);
  assert.equal(tablePaidPlaces(9, 40, 300), 9);
  // Missing or impossible numbers keep the fallback.
  assert.equal(tablePaidPlaces(9, 0, 300, 8), 8);
  assert.equal(tablePaidPlaces(9, 100, 50, 8), 8);
});
