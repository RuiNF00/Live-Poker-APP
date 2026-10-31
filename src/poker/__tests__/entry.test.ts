/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buttonForHeroPosition, replay } from '../engine';
import { callerCandidates, onlyCaller, sizePresets, sizeText, skipTo } from '../entry';
import type { Hand } from '../types';

function mk(over: Partial<Hand> = {}): Hand {
  const players = Array.from({ length: 9 }, (_, i) => ({ name: i ? `V${i}` : 'Hero', stack: 20000, cards: i ? undefined : ['As', 'Kd'] }));
  return {
    v: 1, id: 't', createdAt: 0, updatedAt: 0,
    game: { kind: 'mtt', name: 'T', sb: 100, bb: 200, ante: 200, anteType: 'bb', currency: '€' },
    players, button: buttonForHeroPosition(9, 0, 'CO'), hero: 0, actions: [], board: [], tags: [], notes: '',
    ...over,
  };
}

test('typical hand: fold to hero, open, only BTN calls → flop', () => {
  let h = mk();
  h = { ...h, actions: skipTo(h, replay(h).final, h.hero) };
  assert.equal(replay(h).final.toAct, h.hero);
  h = { ...h, actions: [...h.actions, { p: 0, kind: 'raise', to: 500 }] };
  const s = replay(h).final;
  const cands = callerCandidates(h, s);
  assert.equal(cands.length, 3); // BTN, SB, BB
  const btn = h.button;
  h = { ...h, actions: [...h.actions, ...onlyCaller(h, s, btn)] };
  const f = replay(h).final;
  assert.equal(f.needsBoard, true);
  assert.equal(f.folded.filter((x) => !x).length, 2);
});

test('everyone folds to hero raise ends the hand', () => {
  let h = mk();
  h = { ...h, actions: [...skipTo(h, replay(h).final, 0), { p: 0, kind: 'raise', to: 500 }] };
  h = { ...h, actions: [...h.actions, ...onlyCaller(h, replay(h).final, null)] };
  const f = replay(h).final;
  assert.equal(f.toAct, null);
  assert.equal(f.foldWin, true);
});

test('shortcut does not apply when hero is not the aggressor', () => {
  const h = mk();
  assert.deepEqual(onlyCaller(h, replay(h).final, 1), []);
});

test('hero in the BB: auto-fold stops at the SB instead of handing hero a walk', () => {
  let h = mk({ button: buttonForHeroPosition(9, 0, 'BB') });
  h = { ...h, actions: skipTo(h, replay(h).final, h.hero) };
  const s = replay(h).final;
  assert.equal(h.actions.length, 7);
  assert.notEqual(s.toAct, null);
  assert.notEqual(s.toAct, h.hero);
});

test('limped pot: "nobody else" folds BTN and SB but the big blind checks', () => {
  let h = mk();
  h = { ...h, actions: [...skipTo(h, replay(h).final, 0), { p: 0, kind: 'call' }] };
  h = { ...h, actions: [...h.actions, ...onlyCaller(h, replay(h).final, null)] };
  const f = replay(h).final;
  const bb = (h.button + 2) % 9;
  assert.equal(h.actions.at(-1)!.p, bb);
  assert.equal(h.actions.at(-1)!.kind, 'check');
  assert.equal(f.folded[bb], false);
  assert.equal(f.needsBoard, true);
});

test('stepBack walks a saved hand back one step at a time', async () => {
  const { stepBack } = await import('../entry');
  let h = mk();
  h = { ...h, actions: [...skipTo(h, replay(h).final, 0), { p: 0, kind: 'raise', to: 500 }] };
  h = { ...h, actions: [...h.actions, ...onlyCaller(h, replay(h).final, h.button)], board: ['2c', '7d', 'Ts'] };
  const n = h.actions.length;
  // Flop dealt, nobody acted on it: the flop goes back with the action that closed preflop.
  const b1 = stepBack(h)!;
  assert.equal(b1.actions.length, n - 1);
  assert.deepEqual(b1.board, []);
  // A board card the action hasn't reached is the first thing to go.
  const b2 = stepBack({ ...h, board: ['2c', '7d', 'Ts', 'Kh'] })!;
  assert.deepEqual(b2.board, ['2c', '7d', 'Ts']);
  assert.equal(b2.actions.length, n);
  assert.equal(stepBack(mk()), null);
});

test('a small blind as big as the bb (5/5) is not a limper: opens count in bb from zero', () => {
  const cash = (sb: number, bb: number) => mk({ game: { kind: 'cash', name: `${sb}/${bb}`, sb, bb, ante: 0, anteType: 'none', currency: '$' } });
  for (const [sb, bb] of [[2, 5], [5, 5]]) {
    let h = cash(sb, bb);
    h = { ...h, actions: skipTo(h, replay(h).final, h.hero) };
    const s = replay(h).final;
    assert.deepEqual(sizePresets(h, s).filter((x) => !x.allIn).map((x) => x.to), [3 * bb, 4 * bb, 5 * bb], `${sb}/${bb}`);
    assert.equal(sizeText(h, s, 5 * bb), '5x', `${sb}/${bb}`);
  }
  // A real limper still adds one bb.
  let h = cash(5, 5);
  const s0 = replay(h).final;
  const utg = s0.toAct!;
  h = { ...h, actions: [{ p: utg, kind: 'call' }] };
  h = { ...h, actions: [...h.actions, ...skipTo(h, replay(h).final, h.hero)] };
  assert.equal(sizeText(h, replay(h).final, 25), '4x');
});
