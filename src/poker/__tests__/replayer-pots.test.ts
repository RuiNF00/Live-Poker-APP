/// <reference types="node" />
// The replayer's pots, end to end: the app's engine and the shared page (hand-format) pay every pot the
// same, chops included, in hold'em and PLO, with side pots and run it twice. And the Instagram story
// shows hero's result once it is known, a fold included.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReplay, fromAppHand } from '../../../packages/hand-format/src';
import { heroNet } from '../../story/moment';
import { legal, replay } from '../engine';
import type { CardCode, GameInfo, Hand, HandAction } from '../types';

function webWon(hand: Hand): number[] {
  const steps = buildReplay(fromAppHand(hand as never).hand);
  const last = steps[steps.length - 1] as { winners?: { seat: number; amount: number }[] };
  const won = new Array(hand.players.length).fill(0);
  for (const w of last.winners ?? []) won[w.seat - 1] += w.amount;
  return won;
}

const hand = (game: Partial<GameInfo>, players: Hand['players'], button: number, actions: HandAction[], board: CardCode[], over: Partial<Hand> = {}): Hand =>
  ({
    v: 1, id: 'h', createdAt: 0, updatedAt: 0,
    game: { kind: 'mtt', name: 'T', sb: 25, bb: 50, ante: 25, anteType: 'bb', currency: '€', ...game },
    players, button, hero: 0, actions, board, tags: [], notes: '', ...over,
  }) as Hand;

test('the odd chip of a chop goes to the first winner left of the button, in the app and on the shared page', () => {
  // Button on seat 0: seat 1 is the small blind, the first seat left of the button. 101 + 101 + 50 + ante 25 = 277.
  const h = hand(
    {},
    [{ name: 'Hero', stack: 5000, cards: ['As', 'Kd'] }, { name: '', stack: 5000, cards: ['Ah', 'Kc'] }, { name: '', stack: 5000 }],
    0,
    [{ p: 0, kind: 'raise', to: 101 }, { p: 1, kind: 'call' }, { p: 2, kind: 'fold' }, ...[1, 0, 1, 0, 1, 0].map((p) => ({ p, kind: 'check' as const }))],
    ['2c', '7d', '9s', 'Jh', '3c'],
  );
  const r = replay(h);
  assert.deepEqual(r.result!.won, [138, 139, 0]);
  assert.deepEqual(webWon(h), [138, 139, 0]);
  // Heads-up the button is the small blind: the big blind gets the odd cent of each run-it-twice half
  // (both boards chop 18.69: 9.35 + 9.34 twice).
  const hu = hand(
    { kind: 'cash', sb: 0.25, bb: 0.5, ante: 0, anteType: 'none' },
    [{ name: 'Hero', stack: 20.44, cards: ['As', 'Kd'] }, { name: '', stack: 18.69, cards: ['Ah', 'Kc'] }],
    1,
    [{ p: 1, kind: 'raise', to: 18.69 }, { p: 0, kind: 'call' }],
    ['2c', '7d', '9s', 'Jh', '3c'],
    { board2: ['2d', '7h', '9c', 'Js', '3h'] },
  );
  const won = replay(hu).result!.won;
  assert.deepEqual(won, [18.7, 18.68]);
  assert.deepEqual(webWon(hu), won);
});

test('app and shared page pay the same in 600 random hands: PLO, cent blinds, side pots, run it twice', () => {
  let seed = 20261030;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const DECK = 'AKQJT98765432'.split('').flatMap((r) => 'shdc'.split('').map((s) => r + s));
  let compared = 0;
  for (let t = 0; t < 600; t++) {
    const deck = DECK.map((c) => [rnd(), c] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const n = 2 + Math.floor(rnd() * 5);
    const plo = rnd() < 0.3;
    const cent = rnd() < 0.25;
    const game: Partial<GameInfo> = cent ? { kind: 'cash', sb: 0.25, bb: 0.5, ante: 0, anteType: 'none' } : rnd() < 0.5 ? { sb: 100, bb: 200, ante: 200 } : { kind: 'cash', sb: 1, bb: 2, ante: 0, anteType: 'none' };
    if (plo) game.variant = 'plo';
    const bb = game.bb!;
    const players = Array.from({ length: n }, (_, i) => ({ name: i ? '' : 'Hero', stack: Math.round(bb * (3 + rnd() * 80) * 100) / 100, cards: deck.splice(0, plo ? 4 : 2) as CardCode[] }));
    const h = hand(game, players, Math.floor(rnd() * n), [], deck.splice(0, 5) as CardCode[], rnd() < 0.4 ? { board2: deck.splice(0, 5) as CardCode[] } : {});
    for (let k = 0; k < 60; k++) {
      const s = replay(h).final;
      const lg = s.toAct === null ? null : legal(s);
      if (!lg) break;
      const opts: Omit<HandAction, 'p'>[] = [];
      if (lg.canCheck) opts.push({ kind: 'check' }, { kind: 'check' });
      if (lg.canCall) opts.push({ kind: 'call' }, { kind: 'call' }, { kind: 'fold' });
      if (lg.canBet) opts.push({ kind: 'bet', to: lg.maxTo }, { kind: 'bet', to: lg.minTo });
      if (lg.canRaise) opts.push({ kind: 'raise', to: lg.maxTo }, { kind: 'raise', to: lg.minTo });
      h.actions.push({ p: lg.p, ...opts[Math.floor(rnd() * opts.length)] } as HandAction);
    }
    const r = replay(h);
    if (!r.result?.resolved) continue;
    compared++;
    const web = webWon(h);
    r.result.won.forEach((x, i) => assert.ok(Math.abs(x - web[i]) < 0.001, `hand ${t}: app ${r.result!.won} web ${web}\n${JSON.stringify(h)}`));
  }
  assert.ok(compared > 300, `${compared} hands compared`);
});

test("the story shows hero's result once known: a fold loses what hero put in", () => {
  const players = [{ name: 'Hero', stack: 20000, cards: ['Js', 'Td'] as CardCode[] }, { name: '', stack: 20000 }, { name: '', stack: 20000 }];
  // Hero opens, the small blind 3-bets, the big blind calls, hero folds: the hand stops there.
  const folded = hand({ ante: 0, anteType: 'none', sb: 100, bb: 200 }, players, 0, [{ p: 0, kind: 'raise', to: 500 }, { p: 1, kind: 'raise', to: 1800 }, { p: 2, kind: 'call' }, { p: 0, kind: 'fold' }], []);
  assert.equal(replay(folded).result, null);
  assert.equal(heroNet(folded), -500);
  // Still in a pot nobody has won (the board isn't out): nothing to show yet.
  const live = hand({ ante: 0, anteType: 'none', sb: 100, bb: 200 }, players, 0, [{ p: 0, kind: 'raise', to: 500 }, { p: 1, kind: 'call' }, { p: 2, kind: 'call' }], ['2c', '7d', '9s']);
  assert.equal(heroNet(live), null);
  // Settled at showdown: the net, as before.
  const won = hand({ ante: 0, anteType: 'none', sb: 100, bb: 200 }, [{ name: 'Hero', stack: 20000, cards: ['As', 'Ad'] }, { name: '', stack: 20000, cards: ['Kh', 'Kc'] }], 0, [{ p: 0, kind: 'raise', to: 20000 }, { p: 1, kind: 'call' }], ['2c', '7d', '9s', 'Jh', '3c']);
  assert.equal(heroNet(won), 20000);
});
