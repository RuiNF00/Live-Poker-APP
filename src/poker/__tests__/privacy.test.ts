/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { publicHand } from '../privacy';
import type { Hand } from '../types';

const hand = {
  v: 1, id: 'h', createdAt: 0, updatedAt: 0, sessionId: 's', shareToken: 'secret', shareId: 'x',
  game: { kind: 'cash', name: '1/2', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' },
  players: [{ name: 'Rui', stack: 200 }, { name: 'Zé do boné', stack: 300, playerId: 'p_1' }],
  button: 0, hero: 0, actions: [], board: [], tags: [], notes: 'Fold?',
} as unknown as Hand;

test('opponents are anonymous by default, ids and tokens never leave', () => {
  const p = publicHand(hand) as unknown as Record<string, unknown> & Hand;
  assert.equal(p.players[0].name, 'Rui');
  assert.equal(p.players[1].name, '');
  assert.equal('playerId' in p.players[1], false);
  for (const k of ['sessionId', 'shareToken', 'shareId']) assert.equal(k in p, false);
  assert.equal(p.notes, 'Fold?');
});

test('opt-in names, opt-out notes', () => {
  const p = publicHand(hand, { names: true, notes: false });
  assert.equal(p.players[1].name, 'Zé do boné');
  assert.equal(p.notes, '');
});
