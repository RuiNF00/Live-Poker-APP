/// <reference types="node" />
// PLO hands told by voice: «PLO»/«Omaha» deals four cards, «pote» is the most a
// player can bet, and «double suited» pairs the suits the way players mean it.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { replay } from '../engine';
import type { Hand } from '../types';
import { handFromSpeech } from '../voice';
import { base, CASH, line } from './voice-cases';

const suitsOf = (cards: string[] | undefined) => (cards ?? []).map((c) => c[1]);
const ranksOf = (cards: string[] | undefined) => (cards ?? []).map((c) => c[0]).join('');

type Case = { text: string; base?: Hand; cards: string; line: string; board?: string; shown?: string; notes?: string[] };

const CASES: Case[] = [
  // pt-PT
  {
    text: 'PLO. Estou no botão com ás ás rei dez, o UTG abre para 1000, eu faço pote, ele paga.',
    cards: 'AAKT',
    line: 'UTG r1000, BTN r4000, UTG c',
  },
  {
    text: 'Omaha. Estou no big com nove oito sete seis, o botão abre para 1000, eu pago. Flop dez cinco dois, passo, ele aposta 1500, eu pago.',
    cards: '9876',
    line: 'BTN r1000, BB c, BTN b1500, BB c',
    board: 'T52',
  },
  {
    text: 'PLO. Estou no botão com ás ás rei dez, o UTG abre para 1000, eu pago. Flop rei sete dois, ele aposta pote, eu pago. Ele mostra rei rei sete seis.',
    cards: 'AAKT',
    line: 'UTG r1000, BTN c, UTG b3000, BTN c',
    board: 'K72',
    shown: 'KK76',
  },
  // pt-BR
  {
    text: 'Omaha, tô no botão com ás de copas, rei de copas, dama de espadas, valete de espadas, o cutoff abre pra 1000, eu dou raise pote, ele paga.',
    cards: 'AKQJ',
    line: 'CO r1000, BTN r4000, CO c',
  },
  {
    text: 'PLO. Tô no botão com ás ás rei dez, o UTG abre pra 1000, eu pago. Flop rei sete dois, ele dá pot, eu pago.',
    cards: 'AAKT',
    line: 'UTG r1000, BTN c, UTG b3000, BTN c',
    board: 'K72',
  },
  // es
  {
    text: 'Estoy en el botón jugando PLO con ases y reyes doble palo, el UTG sube a 1000, resubo al bote, él paga.',
    cards: 'AAKK',
    line: 'UTG r1000, BTN r4000, UTG c',
  },
  {
    text: 'Estoy en la ciega grande jugando Omaha con as rey reina jota, el botón sube a 1000, pago. Flop diez nueve dos, paso, apuesta el bote, pago.',
    cards: 'AKQJ',
    line: 'BTN r1000, BB c, BTN b2600, BB c',
    board: 'T92',
  },
  // «Voy al bote» with no «yo»: first person, so hero (Registo QA).
  {
    text: 'Pot limit omaha. Estoy en el botón con as as rey diez, UTG sube a 7, voy al bote, paga.',
    base: base(CASH, 6),
    cards: 'AAKT',
    line: 'UTG r7, BTN r24, UTG c',
  },
  // en
  {
    text: "PLO, I'm on the button with ace ace king jack single suited, UTG raises to 1000, I raise to 50000, he calls.",
    cards: 'AAKJ',
    line: 'UTG r1000, BTN r4000, UTG c',
    notes: ['potLimit'],
  },
  {
    text: "PLO 1/2. I'm in the big blind with ace king queen jack, the button raises to 6, I call. Flop ten nine two, I check, he bets the pot, I call.",
    base: base(CASH, 6),
    cards: 'AKQJ',
    line: 'BTN r6, BB c, BTN b13, BB c',
    board: 'T92',
  },
];

test('PLO by voice: four cards, pot-limit, in every language', () => {
  for (const c of CASES) {
    const r = handFromSpeech(c.text, c.base ?? base());
    const h = r.hand;
    assert.equal(h.game.variant, 'plo', c.text);
    assert.equal(ranksOf(h.players[h.hero].cards), c.cards, c.text);
    assert.equal(line(h), c.line, c.text);
    if (c.board) assert.equal(ranksOf(h.board), c.board, c.text);
    if (c.shown) assert.equal(ranksOf(h.players.find((p, i) => i !== h.hero && p.cards)?.cards), c.shown, c.text);
    for (const n of c.notes ?? []) assert.ok(r.notes.some((x) => x.code === n), `${c.text}: note ${n}`);
    assert.equal(replay(h).invalidAt, null, c.text);
  }
});

test('double suited pairs cards of different ranks; single suited one pair', () => {
  const ds = handFromSpeech('PLO. Estou no botão com ases e reis double suited, o UTG abre para 1000, eu pago.', base()).hand;
  const [a1, a2, k1, k2] = ds.players[ds.hero].cards!;
  assert.equal(new Set(suitsOf([a1, a2, k1, k2])).size, 2);
  assert.ok(a1[1] !== a2[1] && k1[1] !== k2[1], 'the aces (and the kings) never share a suit');

  const ss = handFromSpeech('PLO. Estou no botão com ás ás rei dez single suited, o UTG abre para 1000, eu pago.', base()).hand;
  const s = suitsOf(ss.players[ss.hero].cards);
  assert.equal(new Set(s).size, 3, 'one suit twice, two others once');
});

test('a PLO table needs no «PLO» in the sentence; hold\'em stays two cards', () => {
  const plo = base();
  plo.game = { ...plo.game, variant: 'plo' };
  const h = handFromSpeech('Estou no botão com ás rei dama valete, o UTG abre para 1000, eu pago.', plo).hand;
  assert.equal(ranksOf(h.players[h.hero].cards), 'AKQJ');

  const nlh = handFromSpeech('Estou no botão com ás rei, o UTG abre para 1000, eu dou pot, ele paga.', base()).hand;
  assert.equal(nlh.game.variant, undefined);
  assert.equal(nlh.players[nlh.hero].cards?.length, 2);
  assert.equal(line(nlh), 'UTG r1000, BTN r4000, UTG c');
});

test('PLO: an all-in the pot cannot hold is a pot-sized raise, and the player is told', () => {
  for (const text of [
    'PLO. Estou no botão com ás ás rei dez, o UTG abre para 1000, eu vou all in, ele paga.',
    'PLO. Estoy en el botón con as as rey diez, el UTG sube a 1000, voy all in, él paga.',
  ]) {
    const r = handFromSpeech(text, base());
    assert.equal(line(r.hand), 'UTG r1000, BTN r4000, UTG c', text);
    assert.ok(r.notes.some((x) => x.code === 'potLimit'), text);
  }
  // «Pote» said: that was the size meant, no note.
  const pot = handFromSpeech('PLO. Estou no botão com ás ás rei dez, o UTG abre para 1000, eu faço pote, ele paga.', base());
  assert.ok(!pot.notes.some((x) => x.code === 'potLimit'));
});

test('«PLO 4 jogadores» keeps the table size; PLO5 and Hi-Lo stay PLO with a note', () => {
  const four = handFromSpeech('PLO 4 jogadores. Estou no botão com ás ás rei dez, o cutoff abre para 1000, eu pago.', base());
  assert.equal(four.hand.game.variant, 'plo');
  assert.equal(four.hand.players.length, 4);
  assert.ok(!four.notes.some((x) => x.code === 'ploOnly'));
  for (const text of ['PLO5. Estou no botão com ás ás rei dez, o UTG abre para 1000, eu pago.', 'Omaha Hi-Lo. Estou no botão com ás ás rei dez, o UTG abre para 1000, eu pago.', 'Omaha de cinco cartas. Estou no botão com ás ás rei dez, o UTG abre para 1000, eu pago.']) {
    const r = handFromSpeech(text, base());
    assert.equal(r.hand.game.variant, 'plo', text);
    assert.equal(r.hand.players[r.hand.hero].cards?.length, 4, text);
    assert.ok(r.notes.some((x) => x.code === 'ploOnly'), text);
  }
});
