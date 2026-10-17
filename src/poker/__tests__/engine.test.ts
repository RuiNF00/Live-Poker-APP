/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluate } from '../evaluator';
import { positions, replay, legal, buttonForHeroPosition, splitPot } from '../engine';
import type { Hand } from '../types';

function mk(over: Partial<Hand> = {}): Hand {
  return {
    v: 1, id: 't', createdAt: 0, updatedAt: 0,
    game: { kind: 'mtt', name: 'T', sb: 100, bb: 200, ante: 200, anteType: 'bb', currency: '€' },
    players: [
      { name: 'Hero', stack: 20000, cards: ['As', 'Kd'] },
      { name: 'V1', stack: 20000 },
      { name: 'V2', stack: 20000 },
      { name: 'V3', stack: 20000 },
      { name: 'V4', stack: 20000 },
      { name: 'V5', stack: 20000 },
    ],
    button: 0, hero: 0, actions: [], board: [], tags: [], notes: '',
    ...over,
  };
}

test('positions 6-max and HU', () => {
  assert.deepEqual(positions(6, 0), ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']);
  assert.deepEqual(positions(2, 1), ['BB', 'BTN']);
  assert.deepEqual(positions(9, 0), ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO']);
  assert.equal(positions(6, buttonForHeroPosition(6, 0, 'CO'))[0], 'CO');
});

test('blinds, BB ante, first to act', () => {
  const r = replay(mk());
  const s = r.final;
  assert.equal(s.toAct, 3); // UTG
  assert.equal(s.pot, 200); // BB ante
  assert.equal(s.stacks[2], 20000 - 200 - 200);
  const l = legal(s)!;
  assert.equal(l.toCall, 200);
  assert.equal(l.minTo, 400);
});

test('raise, call, flop needs board, fold win returns uncalled', () => {
  const h = mk({
    actions: [
      { p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'raise', to: 500 },
      { p: 0, kind: 'call' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' },
    ],
  });
  let r = replay(h);
  assert.equal(r.final.street, 'flop');
  assert.equal(r.final.needsBoard, true);
  assert.equal(r.final.pot, 200 + 100 + 200 + 500 + 500);
  h.board = ['Ah', '7c', '2d'];
  r = replay(h);
  assert.equal(r.final.needsBoard, false);
  assert.equal(r.final.toAct, 5); // CO first postflop (blinds folded, BTN last)
  h.actions.push({ p: 5, kind: 'check' }, { p: 0, kind: 'bet', to: 800 }, { p: 5, kind: 'fold' });
  r = replay(h);
  assert.ok(r.result);
  assert.equal(r.result!.won[0], 1500);
  assert.equal(r.result!.net[0], 1500 - 500);
  assert.equal(r.final.stacks[0], 20000 - 500);
});

test('all-in runout with side pot and showdown', () => {
  const h = mk({
    players: [
      { name: 'Hero', stack: 5000, cards: ['As', 'Ad'] },
      { name: 'V1', stack: 20000, cards: ['Kh', 'Kc'] },
      { name: 'V2', stack: 20000, cards: ['Qh', 'Qc'] },
    ],
    game: { kind: 'mtt', name: 'T', sb: 100, bb: 200, ante: 0, anteType: 'none', currency: '€' },
    actions: [
      { p: 0, kind: 'raise', to: 5000 },
      { p: 1, kind: 'raise', to: 20000 },
      { p: 2, kind: 'call' },
    ],
    board: ['2c', '7d', '9s', 'Jh', '3c'],
  });
  const r = replay(h);
  assert.equal(r.invalidAt, null);
  assert.ok(r.result?.resolved);
  assert.equal(r.result!.won[0], 15000);
  assert.equal(r.result!.won[1], 30000);
  assert.equal(r.steps.filter((s) => s.kind === 'board').length, 3);
  assert.equal(r.steps.at(-1)!.kind, 'showdown');
});

test('evaluator ranks', () => {
  const sf = evaluate(['9h', 'Th', 'Jh', 'Qh', 'Kh', '2c', '3d']);
  const quads = evaluate(['9h', '9d', '9s', '9c', 'Kh', '2c', '3d']);
  const wheel = evaluate(['Ah', '2d', '3s', '4c', '5h', 'Kc', 'Kd']);
  const trips = evaluate(['Ah', 'Ad', 'As', '4c', '9h', 'Kc', '2d']);
  assert.equal(sf.name, 'Sequência de cor ao Rei');
  assert.equal(quads.name, 'Poker de 9');
  assert.equal(trips.name, 'Trio de Ases');
  assert.ok(sf.score > quads.score);
  assert.equal(wheel.name, 'Sequência ao 5');
  assert.ok(wheel.score > trips.score);
});

test('splitPot: whole chips, or cents when the pot has cents; never more than the pot', () => {
  assert.deepEqual(splitPot(101, 2), [51, 50]);
  assert.deepEqual(splitPot(3.25, 2), [1.63, 1.62]);
  assert.deepEqual(splitPot(1.5, 2), [0.75, 0.75]);
  assert.deepEqual(splitPot(10, 3), [4, 3, 3]);
  assert.equal(splitPot(0.07, 3).reduce((a, b) => a + b, 0).toFixed(2), '0.07');
});

test('who won, picked without cards: the short all-in takes the main pot, the other winner the side pot', () => {
  // UTG (V3) shoves 2000 short, HJ (V4) and CO (V5) call off deeper; nobody shows. "Quem ganhou?" V3 and V4.
  const players = mk().players.map((p, i) => (i === 3 ? { ...p, stack: 2000 } : i === 4 ? { ...p, stack: 6000 } : i === 5 ? { ...p, stack: 6000 } : p));
  const h = mk({
    players,
    actions: [{ p: 3, kind: 'raise', to: 2000 }, { p: 4, kind: 'raise', to: 6000 }, { p: 5, kind: 'call' }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }],
    board: ['2c', '7d', '9s', 'Th', '3c'],
    winners: [3, 4],
  });
  const res = replay(h).result!;
  assert.ok(res.resolved);
  // Main: 3 × 2000 + blinds 300 + BB ante 200 = 6500, all to V3. Side: 2 × 4000 = 8000, all to V4.
  assert.equal(res.won[3], 6500);
  assert.equal(res.won[4], 8000);
  assert.equal(res.won[5], 0);
});

test('who won, picked without cards: two winners all-in for the same amount chop', () => {
  const h = mk({
    actions: [{ p: 3, kind: 'raise', to: 600 }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'call' }, { p: 2, kind: 'check' }, { p: 3, kind: 'check' }, { p: 2, kind: 'check' }, { p: 3, kind: 'check' }, { p: 2, kind: 'check' }, { p: 3, kind: 'check' }],
    board: ['2c', '7d', '9s', 'Th', '3c'],
    winners: [2, 3],
  });
  const res = replay(h).result!;
  assert.equal(res.won[2], res.won[3]);
});
