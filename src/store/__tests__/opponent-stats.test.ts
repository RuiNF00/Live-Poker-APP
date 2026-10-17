/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buttonForHeroPosition, positions, replay } from '../../poker/engine';
import { skipTo } from '../../poker/entry';
import type { Hand, HandAction } from '../../poker/types';
import { handCounts, opponentStats, sessionsSeen } from '../queries';
import type { PlayerNote } from '../types';

const note = (id: string, name: string): PlayerNote => ({ id, name, look: '', tags: [], notes: '', createdAt: 0, updatedAt: 0 });
const ZE = note('p_ze', 'Zé');

/** 6-max, hero on the BTN, Zé in the seat named `zePos`, actions by position label. */
function hand(id: string, zePos: string, line: [string, HandAction['kind'], number?][], link = false): Hand {
  const players = Array.from({ length: 6 }, (_, i) => ({ name: i ? '' : 'Hero', stack: 10000 }));
  let h: Hand = {
    v: 1, id, createdAt: 0, updatedAt: 0,
    game: { kind: 'cash', name: 'C', sb: 50, bb: 100, ante: 0, anteType: 'none', currency: '€' },
    players, button: buttonForHeroPosition(6, 0, 'BTN'), hero: 0, actions: [], board: [], tags: [], notes: '',
  };
  const pos = positions(6, h.button);
  const z = pos.indexOf(zePos);
  h = { ...h, players: h.players.map((p, i) => (i === z ? { ...p, name: link ? 'Boné' : 'zé ', playerId: link ? ZE.id : undefined } : p)) };
  for (const [label, kind, to] of line) {
    const seat = label === 'Hero' ? 0 : pos.indexOf(label);
    const s = replay(h).final;
    h = { ...h, actions: [...h.actions, ...skipTo(h, s, seat), { p: seat, kind, to }] };
  }
  return h;
}

test('VPIP, PFR and 3-bet from the hands entered against a player', () => {
  const hands = [
    hand('a', 'CO', [['CO', 'raise', 250], ['Hero', 'call'], ['SB', 'fold'], ['BB', 'fold']]), // open: VPIP + PFR
    hand('b', 'CO', [['UTG', 'raise', 250], ['CO', 'raise', 800]]), // 3-bet
    hand('c', 'CO', [['UTG', 'raise', 250], ['CO', 'call']]), // flat: VPIP, 3-bet chance missed
    hand('d', 'CO', [['UTG', 'raise', 250], ['CO', 'fold']]), // folds to the open
    hand('e', 'BB', [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['Hero', 'fold'], ['SB', 'fold']]), // walk: no action, not counted
    hand('f', 'HJ', [['UTG', 'raise', 250], ['HJ', 'call']], true), // linked by note, other name
  ];
  const st = opponentStats(hands, [ZE]).get(ZE.id)!;
  assert.deepEqual(st, { hands: 5, vpip: 4, pfr: 2, threeBet: 1, threeBetOpp: 4 });
  assert.equal(handCounts(hands, [ZE]).get(ZE.id), 6, 'the walk still counts as a hand together');
});

test('an unfinished hand where the player has not acted yet adds nothing', () => {
  const h = hand('g', 'CO', [['UTG', 'fold']]);
  assert.equal(opponentStats([h], [ZE]).get(ZE.id), undefined);
});

test('"visto em n sessões": one per session, or per day for hands outside a session', () => {
  const day = (d: number) => new Date(2026, 9, d, 21).getTime();
  const at = (h: Hand, createdAt: number, sessionId?: string): Hand => ({ ...h, createdAt, sessionId });
  const hands = [
    at(hand('a', 'CO', []), day(3), 's1'),
    at(hand('b', 'CO', []), day(3), 's1'),
    at(hand('c', 'HJ', [], true), day(10), 's2'),
    at(hand('d', 'CO', []), day(12)),
    at(hand('e', 'CO', []), day(12) + 3600e3),
  ];
  assert.equal(sessionsSeen(hands, [ZE]).get(ZE.id), 3);
  assert.equal(sessionsSeen(hands, [note('p_x', 'Ninguém')]).get('p_x'), undefined);
});
