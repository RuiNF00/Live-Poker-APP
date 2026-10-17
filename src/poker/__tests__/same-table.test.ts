/// <reference types="node" />
// Between hands at the same table: players stay in their seats with the
// stacks they ended on, the button moves one seat on, and a seat change,
// someone leaving or someone sitting down is one tap.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { positions } from '../engine';
import { addSeat, endStacks, gameForPlays, newHand, removeSeat, sameTable, swapSeats } from '../factory';
import type { Hand } from '../types';
import type { Session } from '@/store/types';

function played(over: Partial<Hand> = {}): Hand {
  // 6-max 1/2, hero BTN opens to 6, BB (Zé) calls, hero c-bets 8 on the flop, Zé folds.
  return {
    v: 1, id: 'last', createdAt: Date.now() - 60_000, updatedAt: 0,
    game: { kind: 'cash', name: 'Casino', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€', straddles: 1, straddleFrom: 'utg' },
    players: [
      { name: 'Hero', stack: 200, cards: ['As', 'Kd'] },
      { name: 'Ana', stack: 150 },
      { name: 'Zé', stack: 300, playerId: 'pl_ze' },
      { name: '', stack: 100 },
      { name: 'Rui', stack: 250 },
      { name: '', stack: 180 },
    ],
    button: 0, hero: 0, board: ['7c', '8d', '2s'], tags: [], notes: '',
    actions: [
      { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'raise', to: 12 }, { p: 1, kind: 'fold' }, { p: 2, kind: 'call' }, { p: 3, kind: 'fold' },
      { p: 2, kind: 'check' }, { p: 0, kind: 'bet', to: 8 }, { p: 2, kind: 'fold' },
    ],
    ...over,
  };
}

test('the next hand keeps everyone in their seat with the stack they ended on', () => {
  const last = played();
  const ends = endStacks(last);
  const next = newHand({ id: 'n', last });
  assert.deepEqual(next.players.map((p) => p.name), ['Hero', 'Ana', 'Zé', '', 'Rui', '']);
  assert.deepEqual(next.players.map((p) => p.stack), ends);
  assert.equal(next.players[2].playerId, 'pl_ze', 'a known player stays linked');
  assert.equal(ends.reduce((a, b) => a + b, 0), 1180, 'no chip created or lost');
  assert.equal(next.game.straddles, undefined, 'a straddle belongs to one hand');
});

test('the button moves one seat clockwise: hero goes from the button to the cutoff', () => {
  const next = newHand({ id: 'n', last: played() });
  assert.equal(next.button, 1);
  assert.equal(positions(6, next.button)[next.hero], 'CO');
  const wrap = newHand({ id: 'n', last: played({ button: 5 }) });
  assert.equal(wrap.button, 0, 'wraps around the table');
});

test('a busted player is replaced by a new one', () => {
  const last = played({ players: played().players.map((p, i) => (i === 2 ? { ...p, stack: 12 } : p)) });
  last.actions = [
    { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'raise', to: 12 }, { p: 1, kind: 'fold' }, { p: 2, kind: 'call' }, { p: 3, kind: 'fold' },
  ];
  last.board = ['7c', '8d', '2s', '9h', '3c'];
  last.players[2].cards = ['Qh', 'Jc']; // ace high beats queen high
  const next = newHand({ id: 'n', last });
  assert.equal(next.players[2].name, '');
  assert.equal(next.players[2].playerId, undefined);
  assert.ok(next.players[2].stack > 0);
});

test('in a session, the last hand of that session carries over, whatever its age', () => {
  // Saving a hand writes its table size and hero's end stack to the session.
  const session = { id: 's1', kind: 'cash', name: 'Casino', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€', tableSize: 6, stack: 208, roster: [] } as unknown as Session;
  const last = played({ sessionId: 's1', createdAt: Date.now() - 10 * 3600_000 });
  assert.ok(sameTable(last, session));
  const next = newHand({ id: 'n', session, last });
  assert.equal(next.players.length, 6, 'the table as it was');
  assert.equal(next.players[4].name, 'Rui');
  assert.equal(next.button, 1);
  assert.equal(next.sessionId, 's1');
  assert.equal(sameTable(played({ sessionId: 'other' }), session), false, 'another session is another table');
  assert.equal(sameTable(played({ createdAt: Date.now() - 8 * 3600_000 })), false, 'outside a session, a different day starts fresh');
});

test('someone leaving: the seat goes and the button stays on the same player', () => {
  const h = newHand({ id: 'n', last: played() }); // button on seat 1 (Ana)
  const out = removeSeat(h, 3);
  assert.equal(out.players.length, 5);
  assert.deepEqual(out.players.map((p) => p.name), ['Hero', 'Ana', 'Zé', 'Rui', '']);
  assert.equal(out.players[out.button].name, 'Ana');
  const btnLeaves = removeSeat(h, 1);
  assert.equal(btnLeaves.players[btnLeaves.button].name, 'Hero', 'button passes back to the seat on its right');
  assert.equal(removeSeat(h, 0), h, 'hero never leaves this way');
});

test('someone sitting down on the left of a seat, and two players swapping seats', () => {
  const h = newHand({ id: 'n', last: played() });
  const sat = addSeat(h, 2, 200);
  assert.deepEqual(sat.players.map((p) => p.name), ['Hero', 'Ana', 'Zé', '', '', 'Rui', '']);
  assert.equal(sat.players[3].stack, 200);
  assert.equal(sat.players[sat.button].name, 'Ana');
  const sw = swapSeats(h, 2, 4);
  assert.equal(sw.players[2].name, 'Rui');
  assert.equal(sw.players[4].name, 'Zé');
  assert.equal(sw.players[4].playerId, 'pl_ze');
});

test("QA: hero's stack comes from the session screen when it was corrected there", () => {
  const session = { id: 's1', kind: 'cash', name: 'Casino', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€', tableSize: 6, stack: 500, roster: [] } as unknown as Session;
  const last = played({ sessionId: 's1' });
  const next = newHand({ id: 'n', session, last });
  assert.equal(next.players[0].stack, 500);
  assert.equal(next.players[2].name, 'Zé', 'the others still carry over');
});

test('QA: changing the table size on the session starts a new table', () => {
  const session = { id: 's1', kind: 'cash', name: 'Casino', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€', tableSize: 9, stack: 200, roster: [] } as unknown as Session;
  const last = played({ sessionId: 's1' });
  assert.equal(sameTable(last, session), false);
  assert.equal(newHand({ id: 'n', session, last }).players.length, 9);
});

test('the first hand ever takes the game from the first-run answer', () => {
  assert.equal(gameForPlays('mtt2')?.kind, 'mtt');
  assert.deepEqual([gameForPlays('cash1')?.kind, gameForPlays('cash1')?.bb], ['cash', 2]);
  assert.equal(gameForPlays('cash4')?.bb, 100);
  assert.equal(gameForPlays(null), null);
  assert.equal(gameForPlays('weird'), null);
});
