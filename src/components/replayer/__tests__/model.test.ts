/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '@/poker/engine';
import type { Hand } from '@/poker/types';
import { sampleHand } from '@/poker/sample';

import { spokenTable, timeline, viewAt } from '../model';
import { handClassName } from '@/poker/card-name';

const opts = { inBB: false, reveal: false, atEnd: false };

test('heads-up against hidden cards: equity against the range villain raised with', () => {
  const hand = sampleHand('sample');
  const r = replay(hand);
  const k = r.steps.findIndex((s, i) => i > 0 && s.state.toAct === hand.hero && viewAt(hand, r, i, opts).facing && hand.players.filter((_, p) => !s.state.folded[p]).length === 2);
  assert.ok(k > 0, 'sample hand has hero facing a bet heads-up');
  const v = viewAt(hand, r, k, opts);
  assert.ok(v.rangeEq, 'shows equity vs range');
  assert.ok(v.rangeEq!.equity > 0 && v.rangeEq!.equity < 1);
  assert.ok([4, 8, 20, 40].includes(v.rangeEq!.pct));
  assert.equal(v.rangeEq!.custom, false);

  // A range the player drew replaces the guess: aces only crush hero's equity.
  const aces = viewAt(hand, r, k, { ...opts, range: ['AA'] });
  assert.equal(aces.rangeEq!.custom, true);
  assert.equal(aces.rangeEq!.pct, 0.5);
  assert.ok(aces.rangeEq!.equity < v.rangeEq!.equity);
});

test('no range equity while three or more are in the hand', () => {
  const hand = sampleHand('sample');
  const r = replay(hand);
  const k = r.steps.findIndex((s) => hand.players.filter((_, p) => !s.state.folded[p]).length >= 3);
  assert.equal(viewAt(hand, r, Math.max(k, 0), opts).rangeEq, null);
});

test('timeline: long names show the position, never a name cut mid-word', () => {
  const hand = sampleHand('sample');
  const items = timeline(hand, replay(hand), true).filter((it) => it.kind === 'action');
  for (const it of items) assert.ok(it.label.length <= 7 || hand.players.some((p) => p.name === it.label), it.label);
  const names = hand.players.map((p) => p.name).filter(Boolean) as string[];
  for (const it of items) assert.ok(!names.some((n) => n !== it.label && n.startsWith(it.label) && n.length > 7), `cut: ${it.label}`);
});

test('run it twice: both boards at the end, each winner tagged with their board', () => {
  // Folds to the button (hero, AA), who jams; the big blind (KK) calls. Board 1 holds, board 2 brings a king.
  const hand = {
    ...sampleHand('sample'),
    players: Array.from({ length: 6 }, (_, i) => ({ name: i ? '' : 'Hero', stack: 1000, cards: i === 0 ? ['As', 'Ad'] : i === 2 ? ['Kh', 'Kc'] : undefined })),
    button: 0,
    hero: 0,
    actions: [{ p: 3, kind: 'fold' as const }, { p: 4, kind: 'fold' as const }, { p: 5, kind: 'fold' as const }, { p: 0, kind: 'raise' as const, to: 1000 }, { p: 1, kind: 'fold' as const }, { p: 2, kind: 'call' as const }],
    board: ['2c', '7d', '9s', 'Jh', '3c'],
    board2: ['Ks', '4h', '8d', 'Qc', '5s'],
    winners: undefined,
  };
  hand.game = { ...hand.game, sb: 2, bb: 5, ante: 0, anteType: 'none', straddles: 0, bombPot: 0 };
  const r = replay(hand);
  const end = viewAt(hand, r, r.steps.length - 1, { ...opts, atEnd: true });
  assert.deepEqual(end.board2, ['Ks', '4h', '8d', 'Qc', '5s']);
  assert.equal(end.seats[0].run, 1);
  assert.equal(end.seats[2].run, 2);
  assert.equal(end.narration, 'Mesa 1: Hero ganha 1001 (Par de Ases) · Mesa 2: BB ganha 1001 (Trio de Reis)');
  assert.equal(end.seats[2].handName2, 'Trio de Reis');
  // A screen reader hears both boards and each player's hand on each one.
  const said = spokenTable(end);
  assert.match(said, /Mesa 1: Dois de paus, Sete de ouros, Nove de espadas, Valete de copas, Três de paus/);
  assert.match(said, /Mesa 2: Rei de espadas, Quatro de copas, Oito de ouros, Dama de paus, Cinco de espadas/);
  assert.match(said, /Mesa 1 Par de Ases, Mesa 2 Par de Ases/);
  // Before the end only the first board shows.
  assert.equal(viewAt(hand, r, r.steps.length - 1, opts).board2, null);
});

/** 6-max 1/2, button on seat 0 (hero): SB 1, BB 2, UTG 3, HJ 4, CO 5. */
const spot = (actions: Hand['actions'], hero = 0, stacks = [200, 200, 200, 200, 200, 200]): Hand => ({
  v: 1,
  id: 'spot',
  createdAt: 0,
  updatedAt: 0,
  game: { kind: 'cash', name: '1/2', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' },
  players: stacks.map((stack, i) => ({ name: i === hero ? 'Hero' : '', stack, cards: i === hero ? ['Ah', 'Kd'] : undefined })),
  button: 0,
  hero,
  actions,
  board: [],
  tags: [],
  notes: '',
});
const lastView = (h: Hand) => {
  const r = replay(h);
  return viewAt(h, r, r.steps.length - 1, opts);
};

test('folded to hero: an open-or-fold spot, no price and no opponent', () => {
  const v = lastView(spot([{ p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }]));
  assert.equal(v.facing, null);
  assert.equal(v.decision, 'Abrir ou foldar');
});

test('limpers in front: a limped-pot decision, still no pot odds', () => {
  const v = lastView(spot([{ p: 3, kind: 'call' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'call' }]));
  assert.equal(v.facing, null);
  assert.equal(v.decision, 'Pote com limps');
});

test('facing a raise: the raiser, pot odds and MDF', () => {
  const v = lastView(spot([{ p: 3, kind: 'fold' }, { p: 4, kind: 'raise', to: 6 }, { p: 5, kind: 'fold' }]));
  assert.ok(v.facing);
  assert.equal(v.decision, null);
  assert.equal(v.facing!.villain, 4);
  // Pot 1 + 2 + 6 = 9, call 6: 6 / 15.
  assert.ok(Math.abs(v.facing!.potOdds - 0.4) < 1e-9);
});

test('a shove bigger than hero: pot odds against the effective bet', () => {
  // HJ shoves 500 into hero's 100: only 100 of it can be called.
  const v = lastView(spot([{ p: 3, kind: 'fold' }, { p: 4, kind: 'raise', to: 500 }, { p: 5, kind: 'fold' }], 0, [100, 200, 200, 200, 500, 200]));
  // Pot that counts 1 + 2 + 100 = 103, call 100.
  assert.ok(Math.abs(v.facing!.potOdds - 100 / 203) < 1e-9);
});

test('facing a pot-size bet: 50% MDF, 2:1 value to bluffs, size 100%', () => {
  // Hero BB vs BTN: limp-checked to the flop, then BTN bets pot.
  const h = spot(
    [{ p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'call' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'check' }, { p: 2, kind: 'check' }, { p: 0, kind: 'bet', to: 5 }],
    2,
  );
  h.board = ['2c', '7d', '9h'];
  const v = lastView(h);
  assert.ok(v.facing);
  assert.ok(Math.abs(v.facing!.betPct - 1) < 1e-9);
  assert.ok(Math.abs(v.facing!.mdf - 0.5) < 1e-9);
  assert.ok(Math.abs(v.facing!.vb - 2) < 1e-9);
  assert.equal(v.seats[0].badge?.label, 'BET 5 (100%)');
});

test('hero bets half pot: bluff needs 33%, villain gets 25% pot odds', () => {
  const h = spot(
    [{ p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'call' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'check' }, { p: 2, kind: 'check' }, { p: 0, kind: 'bet', to: 2.5 }],
    0,
  );
  h.board = ['2c', '7d', '9h'];
  const v = lastView(h);
  assert.equal(v.facing, null);
  assert.ok(v.heroBet);
  assert.ok(Math.abs(v.heroBet!.pct - 0.5) < 1e-9);
  assert.ok(Math.abs(v.heroBet!.bluffBE - 1 / 3) < 1e-9);
  assert.ok(Math.abs(v.heroBet!.vb - 3) < 1e-9);
  assert.ok(Math.abs(v.heroBet!.vsPotOdds - 0.25) < 1e-9);
});

test('screen reader: the table as one sentence, and grid cells by name', () => {
  const hand = sampleHand('sample');
  const r = replay(hand);
  const v = viewAt(hand, r, r.steps.length - 1, opts);
  const said = spokenTable(v);
  assert.match(said, /Pote /);
  assert.match(said, /\(tu\)/);
  assert.ok(!/[♠♥♦♣]/.test(said), 'cards are words, not suit glyphs');
  assert.equal(handClassName('AKs'), 'Ás e Rei, mesmo naipe');
  assert.equal(handClassName('T9o'), 'Dez e Nove, naipes diferentes');
  assert.equal(handClassName('77'), 'Par, Sete');
});

test('screen reader: actions and streets read as sentences, never "aposta"', () => {
  const hand = sampleHand('sample');
  const r = replay(hand);
  const items = timeline(hand, r, true);
  const flop = items.find((it) => it.label === 'FLOP')!;
  assert.match(flop.spoken, /^Flop: \S+ de \w+, \S+ de \w+, \S+ de \w+$/);
  const raise = items.find((it) => it.kind === 'action' && /faz raise para/.test(it.spoken));
  assert.ok(raise, 'a raise reads "… faz raise para …"');
  assert.match(raise!.spoken, / no (UTG|UTG\+1|UTG\+2|LJ|HJ|CO|BTN|SB|BB) faz raise para |^(UTG|UTG\+1|UTG\+2|LJ|HJ|CO|BTN|SB|BB) faz raise para /);
  for (const it of items) assert.doesNotMatch(it.spoken, /apost/i);
  const k = r.steps.findIndex((s) => s.kind === 'action');
  const v = viewAt(hand, r, k, opts);
  assert.match(spokenTable(v), / faz | paga /);
});

test('screen reader: each step announces the same sentence as its timeline entry', () => {
  const hand = sampleHand('sample');
  const r = replay(hand);
  for (const it of timeline(hand, r, true)) {
    if (it.kind !== 'action' && it.kind !== 'street') continue;
    if (it.k === 0) continue;
    assert.equal(viewAt(hand, r, it.k, { ...opts, inBB: true, atEnd: false }).spoken, it.spoken);
  }
});
