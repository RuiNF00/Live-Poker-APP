/// <reference types="node" />
// "Contar a mão": hands told the way players tell them, in pt-PT, pt-BR,
// Spanish and English, must come out as the hand the entry screen would build.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CASES, check } from './voice-cases';
import { run as runQa } from './voice-qa/harness';
import { PT } from './voice-qa/pt';
import { BR } from './voice-qa/br';
import { ES } from './voice-qa/es';
import { EN } from './voice-qa/en';

import { positions, replay } from '../engine';
import type { GameInfo, Hand } from '../types';
import { handFromSpeech } from '../voice';

const MTT: GameInfo = { kind: 'mtt', name: 'T', sb: 200, bb: 400, ante: 400, anteType: 'bb', currency: '€' };
const CASH: GameInfo = { kind: 'cash', name: '', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' };

function base(game: GameInfo = MTT, n = 9): Hand {
  const stack = game.bb * 100;
  return {
    v: 1, id: 't', createdAt: 0, updatedAt: 0, game,
    players: Array.from({ length: n }, (_, i) => ({ name: i ? '' : 'Hero', stack })),
    button: 0, hero: 0, actions: [], board: [], tags: [], notes: '',
  };
}

/** The hand as a short line: "UTG r1000, BTN c" (folds and checks left out unless asked). */
function line(h: Hand, all = false) {
  const pos = positions(h.players.length, h.button);
  return h.actions
    .filter((a) => all || (a.kind !== 'fold' && a.kind !== 'check'))
    .map((a) => `${pos[a.p]} ${a.kind === 'check' ? 'k' : a.kind[0]}${a.to ?? ''}`)
    .join(', ');
}
const heroPos = (h: Hand) => positions(h.players.length, h.button)[h.hero];
const ranks = (cards: string[] | undefined) => (cards ?? []).map((c) => c[0]).join('');
const seat = (h: Hand, label: string) => positions(h.players.length, h.button).indexOf(label);

test('pt-PT: a full hand to showdown, with suits said and guessed', () => {
  const r = handFromSpeech(
    'Estou no botão com ás rei de copas. O UTG abre para 1000, eu pago. Flop rei sete dois arco-íris. Ele faz check, eu aposto 1200, ele paga. Turn um ás de ouros, check check. River dez, ele aposta 5000 e eu pago. Ele mostra rainha valete.',
    base(),
  );
  const h = r.hand;
  assert.equal(heroPos(h), 'BTN');
  assert.deepEqual(h.players[h.hero].cards, ['Ah', 'Kh']);
  assert.equal(line(h), 'UTG r1000, BTN c, BTN b1200, UTG c, UTG b5000, BTN c');
  assert.equal(ranks(h.board), 'K72AT');
  assert.equal(h.board[3], 'Ad');
  // Rainbow flop, and no guessed card is the same suit as another on it.
  assert.equal(new Set(h.board.slice(0, 3).map((c) => c[1])).size, 3);
  assert.equal(ranks(h.players[seat(h, 'UTG')].cards), 'QJ');
  assert.ok(replay(h).result, 'the hand is played out');
  assert.equal(replay(h).invalidAt, null);
  assert.ok(r.posKnown);
  assert.ok(r.notes.some((n) => n.code === 'suits' && n.street === 'flop'));
  assert.ok(!r.guessed.includes('Ah') && !r.guessed.includes('Ad'));
});

test('pt-PT: fold até mim, 3-bet, all-in and a call with the cards shown', () => {
  const h = handFromSpeech(
    'Hero no cutoff com AK offsuit, fold até mim, abro para 900, o botão faz 3bet para 2700, eu vou all-in, ele paga com QQ. Flop 9 5 2, turn K, river 3. Ganho.',
    base(),
  ).hand;
  assert.equal(heroPos(h), 'CO');
  const [a, k] = h.players[h.hero].cards!;
  assert.equal(a[0] + k[0], 'AK');
  assert.notEqual(a[1], k[1], 'offsuit');
  assert.equal(line(h), 'CO r900, BTN r2700, CO r40000, BTN c');
  assert.equal(ranks(h.players[seat(h, 'BTN')].cards), 'QQ');
  assert.equal(ranks(h.board), '952K3');
  // Both hands are known: the cards decide, no manual winner.
  assert.equal(h.winners, undefined);
});

test('pt-BR: mesa de 6, limps, "dá mesa", check-raise, two-tone flop, "correu", "tinha"', () => {
  const r = handFromSpeech(
    'Mesa de 6, tô no small blind com dama valete de espadas. Dois jogadores limpam, o UTG e o cutoff, eu completo, o big dá mesa. Flop vem valete, oito, três com duas espadas. Eu dou mesa, big blind aposta 1200, o UTG correu, o cutoff paga, eu dou check-raise para 5000. Big blind corre, cutoff paga. Turn cai um dois. Eu aposto metade do pote, ele vai all-in e eu pago. Ele tinha ás oito.',
    base(),
  );
  const h = r.hand;
  assert.equal(h.players.length, 6);
  assert.equal(heroPos(h), 'SB');
  assert.deepEqual(h.players[h.hero].cards, ['Qs', 'Js']);
  assert.equal(line(h), 'UTG c, CO c, SB c, BB b1200, CO c, SB r5000, CO c, SB b6600, CO r34600, SB c');
  assert.equal(h.board.slice(0, 3).filter((c) => c[1] === 's').length, 2, 'two spades on the flop');
  assert.equal(ranks(h.players[seat(h, 'CO')].cards), 'A8');
  // The river wasn't said: the entry screen asks for it.
  assert.equal(replay(h).final.needsBoard, true);
});

test('pt-BR: effective stacks, 2,2x open, 4-bet all-in, "vira"', () => {
  const h = handFromSpeech(
    'Tô no cutoff com par de dez, 25 bb efetivos. O UTG+1 abre 2,2x, eu dou 3bet pra 2400, ele dá 4bet all-in e eu pago. Ele vira ás rei. Flop dama nove quatro, turn sete, river dez. Ganhei.',
    base(),
  ).hand;
  assert.ok(h.players.every((p) => p.stack === 10000), '25 bb each');
  assert.equal(ranks(h.players[h.hero].cards), 'TT');
  assert.equal(line(h), 'UTG+1 r880, CO r2400, UTG+1 r10000, CO c');
  assert.equal(ranks(h.players[seat(h, 'UTG+1')].cards), 'AK');
});

test('pt: told out of turn, hero acts first; "só o small paga"; "foge"', () => {
  const h = handFromSpeech(
    'Estou de big blind com sete seis, o botão limpa, o small completa, eu passo. Flop sete sete dois. O small aposta 800, o botão paga, eu subo para 3000, só o small paga. Turn ás, ele faz check, eu aposto 5000 e ele foge.',
    base(),
  ).hand;
  assert.equal(heroPos(h), 'BB');
  assert.equal(line(h, true).split(', ').slice(-4).join(', '), 'SB k, BB b5000, BTN f, SB f');
  assert.ok(line(h).includes('SB b800, BB r3000'));
  assert.equal(replay(h).final.foldWin, true);
});

test('pt: numbers as words, "3 500", an all-in that sets the stack', () => {
  const h = handFromSpeech(
    'No botão com A K. O UTG abre para dois mil e quinhentos, eu pago. Flop 9 5 2, ele aposta 3 500, eu vou all-in de 12 500 e ele paga.',
    base(),
  ).hand;
  assert.equal(line(h), 'UTG r2500, BTN c, UTG b3500, BTN r12500, UTG c');
  // All-in for 12 500 on the flop, after 2 500 preflop: a 15 000 stack.
  assert.equal(h.players[h.hero].stack, 15000);
});

test('pt: cash with blinds and a stack said, 9 8 suited, only the big calls', () => {
  const h = handFromSpeech(
    'Blinds 1/2, cash, tenho 300 de stack. UTG abre 10, eu no botão pago com 9 8 suited, big blind paga. Flop 10 7 2. Check, check, eu aposto 20, só o big paga. Turn ás, check check. River 6, ele aposta 60, eu subo para 200 e ele paga. Mostra ás rei, ganho com a sequência.',
    base(CASH),
  ).hand;
  assert.equal(h.game.bb, 2);
  assert.equal(h.players[h.hero].stack, 300);
  const [a, b] = h.players[h.hero].cards!;
  assert.equal(a[1], b[1], 'suited');
  assert.equal(line(h), 'UTG r10, BTN c, BB c, BTN b20, BB c, BB b60, BTN r200, BB c');
  assert.equal(ranks(h.players[seat(h, 'BB')].cards), 'AK');
});

test('es: ciega grande, se retira, sale, pagó', () => {
  const h = handFromSpeech(
    'Yo en la ciega grande con as rey de picas. El botón sube a 1200, la ciega pequeña se retira, yo pago. En el flop sale rey, siete, dos. Yo paso, él apuesta 1500, yo pago. Turn cinco de corazones. Paso, él pasa. River dama. Apuesto 3000 y él pagó. Él muestra rey dama.',
    base(),
  ).hand;
  assert.equal(heroPos(h), 'BB');
  assert.deepEqual(h.players[h.hero].cards, ['As', 'Ks']);
  assert.equal(line(h), 'BTN r1200, BB c, BTN b1500, BB c, BB b3000, BTN c');
  assert.equal(h.board[3], '5h');
  assert.equal(ranks(h.players[seat(h, 'BTN')].cards), 'KQ');
});

test('en: big blinds, half pot, raise, all in, cards shown before the runout', () => {
  const h = handFromSpeech(
    "I'm in the big blind with pocket sevens. Button opens to 2.5 big blinds, small blind folds, I call. Flop is seven of hearts, eight of clubs, nine of hearts. I check, he bets half pot, I raise to 4000, he goes all in, I call. He shows jack ten. Turn two, river ace.",
    base(),
  ).hand;
  assert.equal(heroPos(h), 'BB');
  assert.equal(ranks(h.players[h.hero].cards), '77');
  assert.ok(!h.players[h.hero].cards!.includes('7h'), 'the 7h is on the board');
  assert.deepEqual(h.board.slice(0, 3), ['7h', '8c', '9h']);
  assert.equal(line(h), 'BTN r1000, BB c, BTN b1300, BB r4000, BTN r39000, BB c');
  assert.equal(ranks(h.players[seat(h, 'BTN')].cards), 'JT');
  assert.equal(h.board.length, 5);
});

test('en: 3x, three-bet, two clubs, c-bet, pot-size bet, fold', () => {
  const h = handFromSpeech(
    "Button raise 3x, I'm in the small blind with ace queen, I three-bet to 3600, big blind folds, button calls. Flop ace eight six with two clubs. I c-bet 2500, he calls. Turn king. I bet the pot, he folds.",
    base(),
  ).hand;
  assert.equal(heroPos(h), 'SB');
  assert.equal(line(h), 'BTN r1200, SB r3600, BTN c, SB b2500, BTN c, SB b13000');
  assert.equal(h.board.slice(0, 3).filter((c) => c[1] === 'c').length, 2);
  assert.equal(replay(h).final.foldWin, true);
});

test('en: thousands with a comma', () => {
  const h = handFromSpeech('Button, AK. UTG raises to 2,500, I call. Flop nine five two. He bets 3,000, I fold.', base()).hand;
  assert.equal(heroPos(h), 'BTN');
  assert.equal(line(h), 'UTG r2500, BTN c, UTG b3000');
});

test('a missing card stops the hand at that street, without inventing it', () => {
  const r = handFromSpeech('No botão com ás rei. UTG abre 1000, eu pago. Flop rei sete. Ele aposta 2000.', base());
  assert.equal(r.hand.board.length, 0);
  assert.ok(r.notes.some((n) => n.code === 'boardMissing' && n.street === 'flop'));
  assert.equal(line(r.hand), 'UTG r1000, BTN c');
});

test('a size nobody said is the usual one, and says so', () => {
  const r = handFromSpeech('Estou no CO com AQ, abro, o botão paga.', base());
  assert.equal(line(r.hand), 'CO r1000, BTN c');
  assert.ok(r.notes.some((n) => n.code === 'size'));
});

test('missing position and cards are listed; nothing poker-like is empty', () => {
  const r = handFromSpeech('O UTG abre para 1000 e eu pago.', base());
  assert.ok(r.notes.some((n) => n.code === 'noPosition'));
  assert.ok(r.notes.some((n) => n.code === 'noCards'));
  assert.equal(r.empty, false);
  assert.equal(handFromSpeech('olá, bom dia', base()).empty, true);
  assert.equal(handFromSpeech('', base()).empty, true);
});

test('never throws, whatever it hears', () => {
  for (const text of ['flop turn river', 'eu eu eu pago pago fold fold all in all in', 'ás ás ás ás ás rei rei rei', '123 456 / 789', 'mesa de 2 mesa de 11 6 max 10 jogadores', 'river ás turn rei flop dois', 'ele ele ele mostra mostra']) {
    const r = handFromSpeech(text, base());
    assert.equal(replay(r.hand).invalidAt, null, text);
  }
});

test('cards already picked stay when the words leave them out', () => {
  const b = base();
  b.players[0] = { ...b.players[0], cards: ['9d', '9c'] };
  const r = handFromSpeech('Estou no botão, o UTG abre para 1000 e eu pago.', b);
  assert.deepEqual(r.hand.players[0].cards, ['9d', '9c']);
  assert.ok(!r.notes.some((n) => n.code === 'noCards' || n.code === 'suits'));
});

test('the told sentences come out as the hand', () => {
  for (const c of CASES) assert.equal(check(c), null, `[${c.lang}] ${c.text}`);
});

test('QA sentences in the four languages', () => {
  for (const c of [...PT, ...BR, ...ES, ...EN]) {
    const r = runQa(c);
    assert.ok(r.ok, `[${c.lang}] ${c.text}\n${r.summary}\n${r.errs.join(' ; ')}`);
  }
});
