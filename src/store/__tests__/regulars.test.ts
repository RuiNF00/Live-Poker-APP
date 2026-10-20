/// <reference types="node" />
// "Tens notas sobre N regulares daqui": who you have notes on and met in this room.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Hand } from '../../poker/types';
import { regularsAt, venueKey } from '../regulars';
import type { PlayerNote } from '../types';

const note = (id: string, name: string, more: Partial<PlayerNote> = {}): PlayerNote => ({ id, name, look: '', tags: ['Tight'], notes: '', createdAt: 0, updatedAt: 0, ...more });
const hand = (createdAt: number, opp: { name: string; playerId?: string }[], more: Partial<Hand> = {}): Hand => ({
  v: 1, id: `h${createdAt}`, createdAt, updatedAt: createdAt,
  game: { kind: 'cash', name: 'Cash', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: 'EUR' },
  players: [{ name: 'Hero', stack: 200 }, ...opp.map((o) => ({ ...o, stack: 200 }))],
  button: 0, hero: 0, actions: [], board: [], tags: [], notes: '', ...more,
});

const players = [note('p1', 'Zé'), note('p2', 'Marco'), note('p3', 'Ana', { tags: [], notes: '', look: '' }), note('p4', 'Rita')];
const sessions = [{ id: 's1', venue: 'Casino Lisboa' }, { id: 's2', venue: 'Casino Estoril' }];

test('venue names match without case, accents or extra spaces', () => {
  assert.equal(venueKey('  Casíno   LISBOA '), 'casino lisboa');
  assert.equal(venueKey(undefined), '');
});

test('regulars of a room: by session venue or hand venue, by note id or name, most recent first', () => {
  const hands = [
    hand(1, [{ name: 'Zé', playerId: 'p1' }], { sessionId: 's1' }),
    hand(2, [{ name: 'marco ' }], { sessionId: 's1' }),
    hand(3, [{ name: 'Rita', playerId: 'p4' }], { sessionId: 's2' }),
    hand(4, [{ name: 'Rita', playerId: 'p4' }], { game: { ...hand(0, []).game, venue: 'casino lisboa' } }),
    hand(5, [{ name: 'Ana', playerId: 'p3' }], { sessionId: 's1' }),
  ];
  assert.deepEqual(regularsAt('Casino Lisboa', hands, sessions, players).map((p) => p.id), ['p4', 'p2', 'p1']);
  assert.deepEqual(regularsAt('Casino Estoril', hands, sessions, players).map((p) => p.id), ['p4']);
  assert.deepEqual(regularsAt('Casino Porto', hands, sessions, players), []);
  assert.deepEqual(regularsAt('', hands, sessions, players), [], 'no venue typed: nothing to say');
});

test('a note that says nothing, the hero and nameless seats are never regulars', () => {
  const hands = [hand(1, [{ name: 'Ana', playerId: 'p3' }, { name: '' }], { sessionId: 's1', players: [{ name: 'Zé', stack: 200 }, { name: 'Ana', stack: 200, playerId: 'p3' }] })];
  assert.deepEqual(regularsAt('Casino Lisboa', hands, sessions, [...players, note('p5', '')]), []);
});
