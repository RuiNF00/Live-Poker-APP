/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { combosOf, equityVsRange, gridClass, HAND_ORDER, rangeOf, rangePct, rangePctForRaises, topClasses, topRange } from '../ranges';

const near = (a: number | null, b: number, eps: number) => assert.ok(a !== null && Math.abs(a - b) < eps, `${a} vs ${b}`);

test('the 169 starting hands, each once', () => {
  assert.equal(HAND_ORDER.length, 169);
  assert.equal(new Set(HAND_ORDER).size, 169);
  assert.equal(HAND_ORDER[0], 'AA');
  assert.equal(HAND_ORDER[168], '32o');
});

test('combo counts: pairs 6, suited 4, offsuit 12', () => {
  assert.equal(combosOf('QQ').length, 6);
  assert.equal(combosOf('AKs').length, 4);
  assert.equal(combosOf('T9o').length, 12);
  assert.ok(combosOf('AKs').every(([a, b]) => a[1] === b[1]));
  assert.ok(combosOf('T9o').every(([a, b]) => a[1] !== b[1]));
});

test('top 100% is every hand, top 2.5% starts with the big pairs', () => {
  assert.equal(topRange(100).length, 1326);
  assert.equal(new Set(topRange(100).map((c) => c.join())).size, 1326);
  const top = new Set(topRange(2.5).map((c) => c[0][0] + c[1][0]));
  assert.ok(top.has('AA') && top.has('KK') && top.has('QQ'));
  assert.ok(!top.has('72'));
});

test('known preflop equities', () => {
  // Textbook numbers: AA ~85.2% and AKo ~64.5% vs a random hand, AA ~82% vs KK, 72o ~34.6% vs random.
  near(equityVsRange(['As', 'Ad'], topRange(100), []), 0.852, 0.02);
  near(equityVsRange(['Ac', 'Kd'], topRange(100), []), 0.645, 0.02);
  near(equityVsRange(['As', 'Ad'], combosOf('KK'), []), 0.82, 0.02);
  near(equityVsRange(['7c', '2d'], topRange(100), []), 0.346, 0.02);
});

test('a tighter range is a tougher opponent', () => {
  const wide = equityVsRange(['Ac', 'Jd'], topRange(40), [])!;
  const tight = equityVsRange(['Ac', 'Jd'], topRange(4), [])!;
  assert.ok(wide > tight + 0.1, `${wide} vs ${tight}`);
});

test('river and turn are counted exactly', () => {
  // Nut flush on the river beats every KK combo that is left.
  assert.equal(equityVsRange(['As', '5s'], combosOf('KK'), ['2s', '7s', '9s', 'Jd', '3c']), 1);
  // Set of nines vs QQ on the turn: only the 2 queens left in 44 rivers save QQ.
  near(equityVsRange(['9c', '9d'], combosOf('QQ'), ['9h', '7d', '2c', '4s']), 1 - 2 / 44, 1e-9);
});

test('blocked combos are left out; nothing left gives null', () => {
  assert.equal(equityVsRange(['Ks', 'Kh'], combosOf('KK'), ['Kd', 'Kc', '2s']), null);
  assert.equal(equityVsRange(['As', 'Ah'], combosOf('AA'), ['Ad', '7c', '2s']), null);
});

test('the same spot always gives the same number', () => {
  assert.equal(equityVsRange(['Qh', 'Jh'], topRange(20), ['Th', '4c', '2d']), equityVsRange(['Qh', 'Jh'], topRange(20), ['Th', '4c', '2d']));
});

test('range from preflop raises', () => {
  assert.deepEqual([0, 1, 2, 3, 5].map(rangePctForRaises), [40, 20, 8, 4, 4]);
});

test('fast enough for a phone', () => {
  const t = Date.now();
  equityVsRange(['Ac', 'Kd'], topRange(20), ['Qh', '7c', '2s']);
  equityVsRange(['Ac', 'Kd'], topRange(20), ['Qh', '7c', '2s', '9d']);
  equityVsRange(['Ac', 'Kd'], topRange(20), []);
  assert.ok(Date.now() - t < 1500, `${Date.now() - t}ms`);
});

test('the 13×13 grid holds each of the 169 hand classes once', () => {
  const cells = new Set<string>();
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) cells.add(gridClass(i, j));
  assert.equal(cells.size, 169);
  assert.deepEqual([...cells].sort(), [...HAND_ORDER].sort());
  assert.equal(gridClass(0, 1), 'AKs');
  assert.equal(gridClass(1, 0), 'AKo');
});

test('top classes match topRange, and their share is about the asked percent', () => {
  assert.equal(rangeOf(topClasses(20)).length, topRange(20).length);
  assert.ok(Math.abs(rangePct(topClasses(20)) - 20) < 1.5);
  assert.equal(rangePct(['AA', 'AKs']), 0.8);
  assert.equal(rangePct([]), 0);
});
