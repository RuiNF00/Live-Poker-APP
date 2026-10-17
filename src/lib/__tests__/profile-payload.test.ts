/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Hand } from '../../poker/types';
import type { Session } from '../../store/types';
import { EMPTY_DRAFT, handleLooksValid, normalizeHandle, profileBody, shareableHands } from '../profile-payload';

const sess = (over: Partial<Session> = {}): Session => ({
  id: 's1', kind: 'mtt', name: 'Main Event', venue: 'Estoril', currency: '€', startedAt: Date.UTC(2026, 9, 1), endedAt: Date.UTC(2026, 9, 1) + 3 * 3600000,
  breaks: [], buyIn: 500, entries: 2, addOn: 0, cashOut: 3000, finish: 4, field: 300, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000, stackLog: [], roster: [], notes: '',
  ...over,
} as Session);

const hand = (id: string, over: Partial<Hand> = {}): Hand => ({ v: 1, id, createdAt: 1, updatedAt: 1, players: [], button: 0, hero: 0, actions: [], board: [], tags: [], notes: '', game: { kind: 'mtt', name: 'x', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' }, ...over }) as Hand;

test('amounts stay on the phone unless the player turns hiding off', () => {
  const all = { sessions: [sess()], hands: [hand('h1', { sessionId: 's1' })] };
  const hidden = profileBody({ ...EMPTY_DRAFT, sessions: ['s1'] }, all, 'abc123def4');
  const card = hidden.profile.sessions[0];
  assert.equal(EMPTY_DRAFT.hideAmounts, true);
  assert.equal('result' in card, false);
  assert.equal('buyIn' in card, false);
  assert.deepEqual([card.finish, card.field, card.hours, card.hands], [4, 300, 3, 1]);
  const shown = profileBody({ ...EMPTY_DRAFT, hideAmounts: false, sessions: ['s1'] }, all, null).profile.sessions[0] as { result: number; buyIn: number };
  assert.equal(shown.buyIn, 1000);
  assert.equal(shown.result, 2000);
});

test('only picked, finished sessions and picked, shared hands go out', () => {
  const all = {
    sessions: [sess(), sess({ id: 's2' }), sess({ id: 'live', endedAt: undefined })],
    hands: [hand('a', { shareId: 'AAA', shareToken: 'ta' }), hand('b'), hand('c', { shareId: 'CCC', shareToken: 'tc' })],
  };
  const body = profileBody({ ...EMPTY_DRAFT, sessions: ['s2', 'live'], hands: ['a', 'b'] }, all, null);
  assert.deepEqual(body.profile.sessions.map((s) => s.id), ['s2']);
  assert.deepEqual(body.hands, [{ id: 'AAA', token: 'ta' }]);
  assert.deepEqual(shareableHands(all.hands).map((h) => h.id), ['a', 'c']);
});

test('handles follow the server rule', () => {
  assert.equal(normalizeHandle(' @Rui.Poker '), 'rui.poker');
  assert.equal(handleLooksValid('rui.poker'), true);
  assert.equal(handleLooksValid('ru'), false);
  assert.equal(handleLooksValid('a..b'), false);
  assert.equal(handleLooksValid('.rui'), false);
});
