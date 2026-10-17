/// <reference types="node" />
// Live-game cases: straddles, button ante, bomb pots, multiway all-ins with
// side pots and chopped pots. Pots must come out to the chip.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { legal, positions, replay, totalPot } from '../engine';
import type { GameInfo, Hand, HandAction } from '../types';

const CASH: GameInfo = { kind: 'cash', name: '2/5', sb: 2, bb: 5, ante: 0, anteType: 'none', currency: '€' };

/** 6-max, button on seat 0; actions by position label. */
function mk(game: Partial<GameInfo>, line: [string, HandAction['kind'], number?][] = [], over: Partial<Hand> = {}): Hand {
  const h: Hand = {
    v: 1, id: 't', createdAt: 0, updatedAt: 0, game: { ...CASH, ...game },
    players: Array.from({ length: 6 }, (_, i) => ({ name: i ? '' : 'Hero', stack: 1000 })),
    button: 0, hero: 0, actions: [], board: [], tags: [], notes: '', ...over,
  };
  const pos = positions(h.players.length, h.button);
  h.actions = line.map(([l, kind, to]) => ({ p: pos.indexOf(l), kind, to }));
  return h;
}
const chipsInPlay = (h: Hand) => {
  const r = replay(h);
  return r.final.stacks.reduce((a, b) => a + b, 0) + totalPot(r.final);
};

test('UTG straddle: action starts left of it and the straddler gets the option', () => {
  const h = mk({ straddles: 1 });
  let s = replay(h).final;
  assert.equal(positions(6, 0)[s.toAct!], 'HJ');
  assert.equal(s.currentBet, 10);
  assert.equal(legal(s)!.minTo, 20, 'a raise is at least another straddle');
  const done = mk({ straddles: 1 }, [['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'fold'], ['BB', 'call']]);
  s = replay(done).final;
  assert.equal(positions(6, 0)[s.toAct!], 'UTG', 'straddler acts last');
  const after = mk({ straddles: 1 }, [['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'fold'], ['BB', 'call'], ['UTG', 'check']]);
  s = replay(after).final;
  assert.equal(s.street, 'flop');
  assert.equal(s.pot, 2 + 10 + 10);
});

test('double straddle: UTG 10, HJ 20, action from CO, min raise to 40', () => {
  const s = replay(mk({ straddles: 2 })).final;
  assert.equal(positions(6, 0)[s.toAct!], 'CO');
  assert.equal(s.currentBet, 20);
  assert.equal(legal(s)!.minTo, 40);
  assert.equal(chipsInPlay(mk({ straddles: 2 })), 6000);
});

test('button straddle: the small blind acts first and the button last', () => {
  const s0 = replay(mk({ straddles: 1, straddleFrom: 'btn' })).final;
  assert.equal(positions(6, 0)[s0.toAct!], 'SB');
  const h = mk({ straddles: 1, straddleFrom: 'btn' }, [['SB', 'fold'], ['BB', 'call'], ['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'call']]);
  const s = replay(h).final;
  assert.equal(positions(6, 0)[s.toAct!], 'BTN');
});

test('button ante: only the button pays it, and it counts in their result', () => {
  const h = mk({ ante: 5, anteType: 'btn' }, [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'fold']]);
  const r = replay(h);
  assert.equal(r.result!.net[2], 2 + 5, 'BB wins the small blind and the ante');
  assert.equal(r.result!.net[0], -5);
});

test('bomb pot: everyone in, no preflop betting, small blind first on the flop', () => {
  const h = mk({ bombPot: 10 }, [], { board: ['Ah', '7c', '2d'] });
  const r = replay(h);
  assert.equal(r.steps[0].state.street, 'flop');
  assert.equal(r.final.pot, 60);
  assert.equal(positions(6, 0)[r.final.toAct!], 'SB');
  // Everyone checks down, the others muck: the winner takes all 60.
  const full = { ...h, winners: [0], board: ['Ah', '7c', '2d', '9s', '3h'], actions: Array.from({ length: 18 }, (_, k) => ({ p: [1, 2, 3, 4, 5, 0][k % 6], kind: 'check' as const })) };
  full.players = full.players.map((p, i) => ({ ...p, cards: i === 0 ? ['As', 'Ad'] : i === 1 ? ['Kc', 'Kd'] : undefined }));
  const rr = replay(full);
  assert.equal(rr.result!.won[0], 60);
  assert.equal(rr.result!.net[0], 50);
  assert.equal(rr.result!.net[3], -10);
});

test('multiway all-in: main pot and side pot, each to the right winner, uncalled chips back', () => {
  // CO short with AA (100), BTN with QQ (300), UTG covers with KK (1000).
  const h = mk({}, [['UTG', 'raise', 1000], ['HJ', 'fold'], ['CO', 'call'], ['BTN', 'call'], ['SB', 'fold'], ['BB', 'fold']], {
    board: ['2c', '7d', '9h', 'Js', '4s'],
  });
  h.players = h.players.map((p, i) =>
    i === 3 ? { ...p, stack: 1000, cards: ['Kh', 'Kc'] } : i === 5 ? { ...p, stack: 100, cards: ['Ah', 'Ac'] } : i === 0 ? { ...p, stack: 300, cards: ['Qh', 'Qc'] } : p,
  );
  const r = replay(h);
  const pots = r.result!.pots.map((p) => [p.amount, p.winners]);
  // Blinds are dead money in the main pot.
  assert.deepEqual(pots, [
    [100 * 3 + 2 + 5, [5]],
    [200 * 2, [3]],
  ]);
  assert.equal(r.result!.won[0], 0, 'QQ loses both pots');
  assert.equal(r.final.stacks[3], 700, 'the uncalled part goes back');
  assert.equal(chipsInPlay(h), 300 + 100 + 1000 * 4, 'no chip lost or made');
});

test('chopped pot: same hand splits, odd chip to the first winner', () => {
  const h = mk({}, [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'raise', 15], ['SB', 'call'], ['BB', 'fold']], {
    board: ['Ac', 'Kd', 'Qh', 'Js', 'Ts'],
    // Flop, turn, river checked through.
  });
  h.actions.push(...Array.from({ length: 6 }, (_, k) => ({ p: k % 2 ? 0 : 1, kind: 'check' as const })));
  h.players = h.players.map((p, i) => (i === 0 ? { ...p, cards: ['2h', '3h'] } : i === 1 ? { ...p, cards: ['4c', '5c'] } : p));
  const r = replay(h);
  assert.equal(r.result!.pots.length, 1);
  assert.deepEqual(r.result!.pots[0].winners, [0, 1]);
  assert.equal(r.result!.won[0] + r.result!.won[1], 35);
  assert.equal(Math.abs(r.result!.won[0] - r.result!.won[1]), 1);
});

test('chop with unknown cards: picking both winners splits the pot', () => {
  const h = mk({}, [['UTG', 'raise', 15], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'fold'], ['BB', 'call']], {
    board: ['Ac', 'Kd', 'Qh', 'Js', '2s'],
    winners: [2, 3],
  });
  h.actions.push(...Array.from({ length: 6 }, (_, k) => ({ p: k % 2 ? 3 : 2, kind: 'check' as const })));
  const r = replay(h);
  assert.equal(r.result!.resolved, true);
  assert.deepEqual(r.result!.won.slice(2, 4), [16, 16]);
});
