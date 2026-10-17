/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { equity } from '../equity';

const near = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('a finished board is all or nothing', () => {
  assert.deepEqual(equity([['As', 'Ah'], ['Ks', 'Kh']], ['2c', '7d', '9h', 'Jc', '3s']), [1, 0]);
});

test('a chopped board splits', () => {
  assert.deepEqual(equity([['2s', '3h'], ['2d', '3c']], ['Ac', 'Kd', 'Qh', 'Jc', 'Ts']), [0.5, 0.5]);
});

test('on the turn, one outer is counted exactly', () => {
  // KK vs AA on 2-7-9-J: only the two kings left win, out of 44 rivers.
  const [aa, kk] = equity([['As', 'Ah'], ['Ks', 'Kh']], ['2c', '7d', '9h', 'Jc']);
  near(kk, 2 / 44, 1e-9);
  near(aa + kk, 1, 1e-9);
});

test('preflop AA vs KK is about 82/18', () => {
  const [aa, kk] = equity([['As', 'Ah'], ['Ks', 'Kh']], []);
  near(aa, 0.82, 0.025);
  near(aa + kk, 1, 1e-9);
});

test('same spot, same number', () => {
  const a = equity([['Ac', 'Qh'], ['Kd', 'Ks']], []);
  const b = equity([['Ac', 'Qh'], ['Kd', 'Ks']], []);
  assert.deepEqual(a, b);
});

// The evaluator before it moved onto score7: every five-card subset, scored
// one by one. Kept here as the reference the fast path must match exactly.
function referenceScore(cards: string[]): number {
  const rv = (c: string) => ({ A: 14, K: 13, Q: 12, J: 11, T: 10 } as Record<string, number>)[c[0]] ?? Number(c[0]);
  const score5 = (five: string[]) => {
    const vals = five.map(rv).sort((a, b) => b - a);
    const flush = five.every((c) => c[1] === five[0][1]);
    let straightHigh = 0;
    if (new Set(vals).size === 5) {
      if (vals[0] - vals[4] === 4) straightHigh = vals[0];
      else if (vals[0] === 14 && vals[1] === 5) straightHigh = 5;
    }
    const counts = new Map<number, number>();
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
    const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const ordered = groups.map((g) => g[0]);
    const shape = groups.map((g) => g[1]).join('');
    let cat: number;
    let kick: number[];
    if (straightHigh && flush) [cat, kick] = [8, [straightHigh]];
    else if (shape === '41') [cat, kick] = [7, ordered];
    else if (shape === '32') [cat, kick] = [6, ordered];
    else if (flush) [cat, kick] = [5, vals];
    else if (straightHigh) [cat, kick] = [4, [straightHigh]];
    else if (shape === '311') [cat, kick] = [3, ordered];
    else if (shape === '221') [cat, kick] = [2, ordered];
    else if (shape === '2111') [cat, kick] = [1, ordered];
    else [cat, kick] = [0, vals];
    let sc = cat;
    for (let i = 0; i < 5; i++) sc = sc * 15 + (kick[i] ?? 0);
    return sc;
  };
  let best = -1;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) best = Math.max(best, score5([cards[a], cards[b], cards[c], cards[d], cards[e]]));
  return best;
}

test('the evaluator gives exactly the old scores, for 5, 6 and 7 cards and every category', async () => {
  const { evaluate } = await import('../evaluator');
  const { FULL_DECK } = await import('../cards');
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hands: string[][] = [
    ['As', 'Ks', 'Qs', 'Js', 'Ts', '9s', '2d'], // straight flush, 6 high cards of the suit
    ['5h', '4h', '3h', '2h', 'Ah', 'Kd', 'Kc'], // steel wheel
    ['9c', '9d', '9h', '9s', 'Ad', 'Kc', 'Kd'], // quads
    ['Qc', 'Qd', 'Qh', '7s', '7d', '7c', '2h'], // two trips: full house
    ['Jc', 'Jd', 'Jh', '4s', '4d', '3c', '3h'], // trips and two pairs
    ['Ah', 'Th', '7h', '5h', '3h', '2h', 'Kd'], // six of a suit
    ['Ac', '2d', '3h', '4s', '5c', 'Kd', 'Qh'], // wheel
    ['Tc', 'Jd', 'Qh', 'Ks', 'Ac', '9d', '8h'], // seven in a row
    ['8c', '8d', '6h', '6s', '4c', '4d', 'Ah'], // three pairs
    ['Kc', 'Kd', '9h', '7s', '5c', '3d', '2h'], // pair
    ['Ac', 'Jd', '9h', '7s', '5c', '3d', '2h'], // high card
  ];
  for (let i = 0; i < 4000; i++) {
    const d = FULL_DECK.slice();
    const h: string[] = [];
    for (let k = 0; k < 5 + (i % 3); k++) h.push(d.splice(Math.floor(rand() * d.length), 1)[0]);
    hands.push(h);
  }
  const seen = new Set<number>();
  for (const h of hands) {
    const e = evaluate(h);
    assert.equal(e.score, referenceScore(h), h.join(' '));
    seen.add(e.category);
  }
  assert.equal(seen.size, 9);
  assert.equal(evaluate(['As', 'Ks']).category, -1);
});
