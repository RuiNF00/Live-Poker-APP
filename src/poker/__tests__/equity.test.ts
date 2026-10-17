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

test('fast scorer agrees with the evaluator', async () => {
  const { evaluate } = await import('../evaluator');
  const { score7 } = await import('../equity');
  const { FULL_DECK, rankValue } = await import('../cards');
  const code = (c: string) => rankValue(c) * 4 + { s: 0, h: 1, d: 2, c: 3 }[c[1] as 's']!;
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hands: string[][] = [];
  for (let i = 0; i < 3000; i++) {
    const d = FULL_DECK.slice();
    const h: string[] = [];
    for (let k = 0; k < 7; k++) h.push(d.splice(Math.floor(rand() * d.length), 1)[0]);
    hands.push(h);
  }
  const ev = hands.map((h) => evaluate(h).score);
  const fast = hands.map((h) => score7(h.map(code)));
  for (let i = 0; i < hands.length; i++)
    for (const j of [i + 1, i + 7]) {
      if (j >= hands.length) continue;
      assert.equal(Math.sign(fast[i] - fast[j]), Math.sign(ev[i] - ev[j]), `${hands[i]} vs ${hands[j]}`);
    }
});
