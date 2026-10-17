/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buttonForHeroPosition, replay } from '../engine';
import { callerCandidates, onlyCaller, skipTo } from '../entry';
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
