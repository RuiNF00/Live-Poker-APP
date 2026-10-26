/// <reference types="node" />
// PLO (first update): four hole cards, exactly two of them in the hand, bets capped at the pot.
// Hold'em hands carry no variant and must replay exactly as before.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buttonForHeroPosition, legal, positions, replay } from '../engine';
import { equity } from '../equity';
import { oddsEquity, oddsHole } from '../odds';
import { comboLabel } from '../cards';
import { matches, NO_FILTER } from '../../store/hand-filters';
import { evaluate, evaluateOmaha } from '../evaluator';
import type { Hand, HandAction } from '../types';
import { holeCount, isPLO } from '../variant';

function mk(variant: 'plo' | undefined, n = 6, heroPos = 'BTN'): Hand {
  return {
    v: 1, id: 'p', createdAt: 0, updatedAt: 0,
    game: { kind: 'cash', name: 'C', sb: 1, bb: 2, ante: 0, anteType: 'bb', currency: '€', ...(variant ? { variant } : null) },
    players: Array.from({ length: n }, (_, i) => ({ name: i ? '' : 'Hero', stack: 400 })),
    button: buttonForHeroPosition(n, 0, heroPos), hero: 0, actions: [], board: [], tags: [], notes: '',
  };
}
const seat = (h: Hand, label: string) => positions(h.players.length, h.button).indexOf(label);
const play = (h: Hand, ...acts: HandAction[]): Hand => ({ ...h, actions: [...h.actions, ...acts] });

test('variant: no field is hold\'em with two cards, plo is four', () => {
  assert.equal(isPLO(mk(undefined).game), false);
  assert.equal(holeCount(mk(undefined).game), 2);
  assert.equal(isPLO(mk('plo').game), true);
  assert.equal(holeCount(mk('plo').game), 4);
});

test('pot limit preflop: UTG can raise to 3.5 bb, hold\'em still to the whole stack', () => {
  const plo = replay(mk('plo')).final;
  assert.equal(plo.toAct, seat(mk('plo'), 'UTG'));
  assert.equal(legal(plo)!.maxTo, 7, '2 + (1 + 2 + 2)');
  assert.equal(legal(plo)!.minTo, 4);
  assert.equal(legal(replay(mk(undefined)).final)!.maxTo, 400);
});

test('pot limit facing a raise: call it, then the pot', () => {
  let h = mk('plo');
  h = play(h, { p: seat(h, 'UTG'), kind: 'raise', to: 7 });
  const s = replay(h).final;
  // HJ: 7 to call, pot after the call 1 + 2 + 7 + 7 = 17, so 7 + 17 = 24.
  assert.equal(legal(s)!.maxTo, 24);
});

test('pot limit postflop: a bet is at most the pot, a raise the pot after calling', () => {
  let h = mk('plo', 2);
  // Heads-up: BTN (SB) completes, BB checks: pot 4.
  h = play(h, { p: h.button, kind: 'call' }, { p: 1 - h.button, kind: 'check' });
  h = { ...h, board: ['Ah', '7c', '2d'] };
  let s = replay(h).final;
  assert.equal(s.street, 'flop');
  assert.equal(legal(s)!.maxTo, 4);
  h = play(h, { p: s.toAct!, kind: 'bet', to: 4 });
  s = replay(h).final;
  assert.equal(legal(s)!.maxTo, 16, '4 + (4 + 4 + 4)');
});

test('a bet entered above the pot in PLO counts as the pot; in hold\'em it stands', () => {
  const plo = mk('plo');
  const utg = seat(plo, 'UTG');
  const s = replay(play(plo, { p: utg, kind: 'raise', to: 50 })).final;
  assert.equal(s.bets[utg], 7);
  const nl = mk(undefined);
  assert.equal(replay(play(nl, { p: utg, kind: 'raise', to: 50 })).final.bets[utg], 50);
});

test('the pot cap never goes over the stack: a short stack is all-in for less', () => {
  let h = mk('plo');
  const utg = seat(h, 'UTG');
  h = { ...h, players: h.players.map((p, i) => (i === utg ? { ...p, stack: 5 } : p)) };
  assert.equal(legal(replay(h).final)!.maxTo, 5);
});

test('Omaha hands use exactly two hole cards: four hearts on the board and one in hand is no flush', () => {
  const board = ['Kh', 'Qh', '9h', '4h', '2c'];
  const plo = evaluateOmaha(['Ah', 'As', '7d', '6c'], board);
  assert.equal(plo.category, 1, 'one pair (aces), not a flush');
  assert.ok(evaluate(['Ah', 'As', ...board]).category >= 5, 'in hold\'em the same cards make a flush');
  const two = evaluateOmaha(['Ah', '3h', '7d', '6c'], board);
  assert.equal(two.category, 5, 'two hearts in hand: the nut flush');
});

test('Omaha: a board straight needs two cards from hand too', () => {
  const board = ['9s', 'Tc', 'Jd', 'Qh', '2c'];
  assert.notEqual(evaluateOmaha(['Ks', '3d', '4h', '5c'], board).category, 4, 'one card to the straight is not enough');
  assert.equal(evaluateOmaha(['Ks', 'Ad', '4h', '5c'], board).category, 4, 'A-K with T-J-Q');
});

test('PLO showdown: four cards each, the pot goes to the best Omaha hand', () => {
  let h = mk('plo', 2);
  const btn = h.button;
  const bb = 1 - btn;
  h = { ...h, players: h.players.map((p, i) => ({ ...p, cards: i === 0 ? ['Ah', 'As', '7d', '6c'] : ['Jc', 'Td', '3s', '3d'] })) };
  h = play(h, { p: btn, kind: 'call' }, { p: bb, kind: 'check' });
  h = { ...h, board: ['Kh', 'Qh', '9h'] };
  h = play(h, { p: bb, kind: 'check' }, { p: btn, kind: 'check' });
  h = { ...h, board: [...h.board, '4h'] };
  h = play(h, { p: bb, kind: 'check' }, { p: btn, kind: 'check' });
  h = { ...h, board: [...h.board, '2c'] };
  h = play(h, { p: bb, kind: 'check' }, { p: btn, kind: 'check' });
  const r = replay(h);
  assert.ok(r.result?.resolved);
  // Villain JT plays K-Q-9 for a straight; hero's aces with one heart are only a pair.
  assert.deepEqual(r.result!.pots[0].winners, [h.hero === 0 ? 1 : 0]);
});

test('PLO showdown waits for four cards, not two', () => {
  let h = mk('plo', 2);
  h = { ...h, players: h.players.map((p, i) => ({ ...p, cards: i === 0 ? ['Ah', 'As', '7d', '6c'] : ['Jc', 'Td'] })) };
  h = play(h, { p: h.button, kind: 'call' }, { p: 1 - h.button, kind: 'check' });
  for (const cards of [['Kh', 'Qh', '9h'], ['4h'], ['2c']]) {
    h = { ...h, board: [...h.board, ...cards] };
    h = play(h, { p: 1 - h.button, kind: 'check' }, { p: h.button, kind: 'check' });
  }
  assert.equal(replay(h).result!.resolved, false, 'two of the villain\'s four cards are not a hand');
});

test('PLO equity on the river: exact, by the Omaha rule', () => {
  const [hero, villain] = equity([['Ah', 'As', '7d', '6c'], ['Jc', 'Td', '3s', '3d']], ['Kh', 'Qh', '9h', '4h', '2c']);
  assert.equal(hero, 0);
  assert.equal(villain, 1);
});

test('PLO sizes: the top chip is «Pote» while the stack covers it, All-in once it does not', async () => {
  const { sizePresets } = await import('../entry');
  const h = mk('plo');
  const s = replay(h).final;
  const ps = sizePresets(h, s);
  const top = ps[ps.length - 1];
  assert.equal(top.to, 7);
  assert.equal(top.allIn, undefined);
  assert.ok(ps.every((p) => p.to <= 7));
  const short = { ...h, players: h.players.map((p, i) => (i === s.toAct ? { ...p, stack: 6 } : p)) };
  const ss = sizePresets(short, replay(short).final);
  assert.equal(ss[ss.length - 1].allIn, true);
  assert.equal(ss[ss.length - 1].to, 6);
  const nl = mk(undefined);
  assert.equal(sizePresets(nl, replay(nl).final).at(-1)!.to, 400, 'hold\'em still shows the all-in');
});

test('PLO hands say so next to their stakes; hold\'em labels are unchanged', async () => {
  const { blindsLabel } = await import('../format');
  assert.equal(blindsLabel(mk('plo')), 'PLO 1/2');
  assert.equal(blindsLabel(mk(undefined)), '1/2');
});

test('PLO sizes: a pot-size raise reads as its multiple on the line, a pot bet as 100%', async () => {
  const { entryLine, sizeText } = await import('../entry');
  // UTG raises the pot preflop: 1 + 2 + 2 (the call) + 2 = 7, i.e. 3.5x the big blind.
  let h = play(mk('plo'), { p: seat(mk('plo'), 'UTG'), kind: 'raise', to: 7 });
  assert.equal(entryLine(h)[0].size!.replace(',', '.'), '3.5x');
  const fold = (p: string) => ({ p: seat(h, p), kind: 'fold' as const });
  h = play(h, fold('HJ'), fold('CO'), { p: 0, kind: 'call' }, fold('SB'), fold('BB'));
  h = { ...h, board: ['2c', '7d', '9h'] };
  const s = replay(h).final;
  const pot = legal(s)!.maxTo;
  assert.equal(sizeText(h, s, pot), '100%', 'the pot cap is a 100% bet');
});

test('odds calculator: PLO needs four cards a side and ignores the hold\'em range', () => {
  const hero = ['Ah', 'As', '7d', '6c'];
  const villain = ['Jc', 'Td', '3s', '3d'];
  const board = ['Kh', 'Qh', '9h', '4h', '2c'];
  assert.equal(oddsEquity('plo', hero.slice(0, 2), villain, board, 'cards', 20), null);
  assert.equal(oddsEquity('plo', hero, villain.slice(0, 3), board, 'cards', 20), null);
  // Range mode left over from hold'em still means cards against cards in PLO.
  const r = oddsEquity('plo', hero, villain, board, 'range', 20)!;
  const [h, v] = equity([hero, villain], board);
  assert.deepEqual(r, { hero: h, villain: v });
  assert.equal(oddsHole('plo'), 4);
  assert.equal(oddsHole('nlhe'), 2);
});

test("odds calculator: hold'em against a range is unchanged", () => {
  const r = oddsEquity('nlhe', ['Ah', 'As'], [], [], 'range', 20)!;
  assert.ok(r.hero > 0.8);
  assert.ok(Math.abs(r.hero + r.villain - 1) < 1e-9);
});

test('a PLO hand reads as its four ranks and never matches a hold\'em combo filter', () => {
  assert.equal(comboLabel(['7d', 'As', '2h', 'Kd']), 'AK72');
  assert.equal(comboLabel(['As', 'Kd']), 'AKo', "hold'em unchanged");
  const h = mk('plo');
  h.players[h.hero] = { ...h.players[h.hero], cards: ['As', 'Kd', '7c', '2h'] };
  assert.equal(matches(h, { ...NO_FILTER, combos: ['AKo'] }), false);
  assert.equal(matches(h, NO_FILTER), true);
});
