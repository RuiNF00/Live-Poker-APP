/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buttonForHeroPosition } from '../engine';
import type { Hand } from '../types';
import { unfinished } from '../unfinished';

function mk(id: string, createdAt: number, done: boolean, sessionId?: string): Hand {
  const players = Array.from({ length: 2 }, (_, i) => ({ name: i ? '' : 'Hero', stack: 20000, cards: i ? undefined : ['As', 'Kd'] }));
  return {
    v: 1, id, createdAt, updatedAt: createdAt, sessionId,
    game: { kind: 'cash', name: 'C', sb: 100, bb: 200, ante: 0, anteType: 'none', currency: '€' },
    players, button: buttonForHeroPosition(2, 0, 'SB'), hero: 0,
    // Heads-up, hero on the button folds: a finished hand. No action yet: unfinished.
    actions: done ? [{ p: 0, kind: 'fold' }] : [], board: [], tags: [], notes: '',
  };
}

test('unfinished: oldest first, and only one session when asked', () => {
  const hands = [mk('c', 3, false, 's1'), mk('b', 2, true, 's1'), mk('a', 1, false, 's2'), mk('d', 4, false, 's1')];
  assert.deepEqual(unfinished(hands).map((h) => h.id), ['a', 'c', 'd']);
  assert.deepEqual(unfinished(hands, 's1').map((h) => h.id), ['c', 'd']);
});
