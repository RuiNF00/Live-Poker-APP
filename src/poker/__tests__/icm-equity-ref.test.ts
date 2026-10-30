/// <reference types="node" />
// The deal calculator, the ICM panel and the equity calculator against reference numbers:
// equities enumerated over every board, ICM against every finishing order, and the edge cases
// of a final table (many players, equal stacks, a stack at zero, payouts typed out of order).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FULL_DECK } from '../cards';
import { cardCode, equity, score5, score7 } from '../equity';
import { chipChop, icm, icmCall, toCents } from '../icm';
import { combosOf, equityVsRange, topRange } from '../ranges';
import type { CardCode } from '../types';

const near = (a: number, b: number, eps: number, what: string) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

test('score7 is the best five of the cards, checked against every five-card subset', () => {
  const best = (c: number[]) => {
    let b = -1;
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++)
        for (let k = j + 1; k < c.length; k++)
          for (let l = k + 1; l < c.length; l++) for (let m = l + 1; m < c.length; m++) b = Math.max(b, score5(c[i], c[j], c[k], c[l], c[m]));
    return b;
  };
  const deck = FULL_DECK.map(cardCode);
  let seed = 11;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let t = 0; t < 30000; t++) {
    const d = deck.slice();
    const n = 5 + (t % 3);
    for (let k = 0; k < n; k++) {
      const r = k + Math.floor(rnd() * (d.length - k));
      [d[k], d[r]] = [d[r], d[k]];
    }
    const c = d.slice(0, n);
    assert.equal(score7(c), best(c), c.join(','));
  }
  // The rare ones a random deal seldom reaches.
  for (const h of ['As 2s 3s 4s 5s Kd Kh', 'Ah Ad Ac As Kh Kd Kc', 'Ah Ad Ac Kh Kd Kc 2s', '9h 9d 9c 9s Ah Kd 2c', 'Ah 2d 3c 4s 5h 6d Kc', 'Th Jh Qh Kh Ah 9h 8h', 'Kh Kd Ks 7h 6h 5h 4h'])
    assert.equal(score7(h.split(' ').map((c) => cardCode(c as CardCode))), best(h.split(' ').map((c) => cardCode(c as CardCode))), h);
});

test("preflop hold'em equity matches the exact number over every board", () => {
  // Enumerated over all 1 712 304 boards (1 370 754 three-handed), like any equity calculator.
  const cases: [string[][], number[]][] = [
    [[['As', 'Ah'], ['Ks', 'Kh']], [0.82637, 0.17363]],
    [[['7s', '2d'], ['As', 'Ah']], [0.11794, 0.88206]],
    [[['Js', 'Th'], ['Ac', 'Kc']], [0.34951, 0.65049]],
    [[['Ah', 'Kd'], ['2s', '2c']], [0.4696, 0.5304]],
    [[['As', 'Ah'], ['Ks', 'Kh'], ['Qs', 'Qh']], [0.6767, 0.17232, 0.15098]],
  ];
  // A sample: a few tenths of a point at most (it was 6 000 boards, up to 0.9 off).
  for (const [hands, exact] of cases) equity(hands as CardCode[][], []).forEach((e, i) => near(e, exact[i], 0.0035, hands.map((h) => h.join('')).join(' vs ')));
});

test('equity against a range: exact against a narrow range on the flop, close to the exact number preflop', () => {
  // QQ against the top 8%: 64.07% over 3 million boards dealt combo by combo (a random combo each board drifted 0.8 off).
  near(equityVsRange(['Qs', 'Qh'], topRange(8), [])!, 0.6407, 0.003, 'QQ vs top 8%');
  // On the flop against JJ+ and AK, every combo and every turn and river: the mean of the exact equities.
  const board: CardCode[] = ['Ks', '7d', '2c'];
  const range = ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'].flatMap(combosOf);
  const live = range.filter((c) => !c.some((x) => ['Ah', 'Kd', ...board].includes(x)));
  const mean = live.reduce((a, c) => a + equity([['Ah', 'Kd'], c], board)[0], 0) / live.length;
  near(equityVsRange(['Ah', 'Kd'], range, board)!, mean, 1e-9, 'AK vs JJ+ AK on K72');
});

/** Malmuth-Harville the long way: every finishing order. */
function everyOrder(stacks: number[], pays: number[]): number[] {
  const out = stacks.map(() => 0);
  const go = (left: number[], p: number, place: number) => {
    if (place >= pays.length || !left.length) return;
    const total = left.reduce((a, i) => a + stacks[i], 0);
    for (const i of left) {
      const q = (p * stacks[i]) / total;
      out[i] += q * pays[place];
      go(left.filter((x) => x !== i), q, place + 1);
    }
  };
  go(stacks.map((_, i) => i), 1, 0);
  return out;
}

test('ICM matches every finishing order, with up to 8 players and short payouts', () => {
  let seed = 3;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let t = 0; t < 150; t++) {
    const n = 2 + Math.floor(rnd() * 7);
    const stacks = Array.from({ length: n }, () => Math.ceil(rnd() * 1e6));
    const pays = Array.from({ length: 1 + Math.floor(rnd() * n) }, () => Math.round(rnd() * 1e5)).sort((a, b) => b - a);
    const ref = everyOrder(stacks, pays);
    icm(stacks, pays).forEach((e, i) => near(e, ref[i], 1e-6, `${stacks} / ${pays}`));
  }
});

test('a 10-handed final table: the pool adds up, equal stacks get the same, and a deal to the cent adds up', () => {
  const stacks = [4_200_000, 3_100_000, 3_100_000, 3_100_000, 2_000_000, 1_500_000, 900_000, 900_000, 600_000, 250_000];
  const pays = [100_000, 62_000, 45_000, 34_000, 26_000, 20_000, 15_500, 12_500, 10_500, 9_000];
  const e = icm(stacks, pays);
  near(e.reduce((a, b) => a + b, 0), 334_500, 1e-6, 'pool');
  assert.equal(e[1], e[2]);
  assert.equal(e[2], e[3]);
  assert.equal(e[6], e[7]);
  for (let i = 1; i < 10; i++) assert.ok(e[i] <= e[i - 1] + 1e-9, 'more chips, more equity');
  assert.ok(e[9] > pays[9] && e[0] < (stacks[0] / stacks.reduce((a, b) => a + b, 0)) * 334_500, 'ICM lifts the short stack and holds back the leader');
  assert.equal(Math.round(toCents(e).reduce((a, b) => a + b, 0) * 100), 33_450_000);
});

test('a stack at zero finishes below every stack with chips, and the pool stays whole', () => {
  // It was paid nothing, and 3rd place's money vanished from the deal.
  assert.deepEqual(icm([100, 0], [70, 30]), [70, 30]);
  assert.deepEqual(icm([100, 0, 0], [50, 30, 20]), [50, 25, 25]);
  // The ICM panel's bust: losing an all-in on the bubble pays the place hero would take.
  const r = icmCall({ stacks: [1000, 3000, 2000], payouts: [50, 30, 20], hero: 0, villain: 1, pot: 1000, call: 1000 });
  assert.equal(r.evLose, 20);
});

test('payouts typed out of order count from the largest down', () => {
  assert.deepEqual(icm([3000, 1000], [60, 100]), icm([3000, 1000], [100, 60]));
});

test('a chip chop never pays more than first place', () => {
  // 9 000 of 10 000 chips: a plain split paid the leader 560 for a 500 first prize.
  const c = chipChop([9000, 500, 500], [500, 300, 200]);
  assert.deepEqual(c, [500, 250, 250]);
  // Capping can push a second big stack over: it is capped too, and the pool still adds up.
  const two = chipChop([6000, 5000, 100, 100], [400, 300, 200, 100]);
  assert.ok(two.every((x) => x <= 400 + 1e-9));
  near(two.reduce((a, b) => a + b, 0), 1000, 1e-9, 'pool');
  // Short of the cap, the plain chip chop as before.
  assert.deepEqual(chipChop([500, 300, 200], [500, 300, 200]), [400, 320, 280]);
});
