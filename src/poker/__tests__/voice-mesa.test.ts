/// <reference types="node" />
// Hands told at a live table, in pt-PT, pt-BR and Spanish: noise, self-corrections, the phone's spellings
// of poker words, multiway and PLO pots. And the cards fixed by tapping stay fixed as the player goes on.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { liveFixes, withFixes } from '../../components/entry/voice-fixes';
import { replay } from '../engine';
import { handFromSpeech } from '../voice';
import { base, line, run } from './voice-qa/harness';
import { TABLE } from './voice-qa/table';

test('hands told at the table come out as said, in the three languages', () => {
  for (const c of TABLE) {
    const r = run(c);
    assert.ok(r.ok, `[${c.lang}] ${c.text}\n${r.summary}\n${r.errs.join(' ; ')}`);
  }
});

test('a correction replaces only what it names: a seat, cards, a board card, an amount, an action', () => {
  const h = (text: string) => handFromSpeech(text, base()).hand;
  // «não» inside a sentence is no correction: «o HJ não paga» is a fold.
  assert.equal(line(h('Estou no botão com ás rei. O UTG abre para 1000, o HJ não paga, eu pago.')), 'UTG r1000, BTN c');
  // Two actions by different seats with different verbs: the second doesn't undo the first.
  assert.equal(line(h('Estoy en el botón con as rey. Subo a 1000, no, y la ciega grande paga.')), 'BTN r1000, BB c');
  // «o sea» as a filler, with nothing like it before, changes nothing.
  assert.equal(line(h('Bueno, o sea, estoy en el botón con as rey, el UTG sube a 1000, pago.')), 'UTG r1000, BTN c');
});

test('PLO multiway: four cards each, the pot raise worked out with every caller in', () => {
  const r = handFromSpeech('PLO. Estou no botão com ás ás rei dez double suited, o UTG abre para 1000, o cutoff paga, eu faço pote, o big paga, o UTG paga, o cutoff paga. Flop rei sete dois, todos passam até mim, aposto 5000, só o big paga.', base());
  const h = r.hand;
  assert.equal(h.game.variant, 'plo');
  assert.equal((h.players[h.hero].cards ?? []).map((c) => c[0]).join(''), 'AAKT');
  // 1000 to call, then the pot: 1000 + 1000 + blinds 600 + ante 400 + the call.
  assert.equal(line(h), 'UTG r1000, CO c, BTN r5000, BB c, UTG c, CO c, BTN b5000, BB c');
  assert.equal(replay(h).invalidAt, null);
  const es = handFromSpeech('PLO. Estoy en el cutoff con as rey reina jota, el UTG sube a 1000, yo pago, el botón paga, la ciega grande paga. Flop diez nueve dos, la grande pasa, el UTG apuesta bote, yo voy con todo.', base()).hand;
  assert.equal(es.players[es.hero].cards?.length, 4);
  assert.equal(line(es), 'UTG r1000, CO c, BTN c, BB c, UTG b4600, CO r18400');
});

test('cards fixed by tapping stay fixed when the player tells more of the hand', () => {
  const first = handFromSpeech('Estou no botão com ás rei. O UTG abre para 1000, eu pago. Flop rei sete dois.', base()).hand;
  // The player taps the flop's king and makes it the king of hearts.
  const from = first.board[0];
  const to = from === 'Kh' ? 'Ks' : 'Kh';
  const fixes = { b0: { from, to } };
  assert.equal(withFixes(first, fixes).board[0], to);
  // More words: the flop is heard the same, so the fix holds (it was lost at every new word).
  const more = handFromSpeech('Estou no botão com ás rei. O UTG abre para 1000, eu pago. Flop rei sete dois. Ele aposta 1500, eu pago. Turn dez.', base()).hand;
  assert.equal(more.board[0], from);
  assert.deepEqual(liveFixes(more, fixes), fixes);
  assert.equal(withFixes(more, fixes).board[0], to);
  // The flop said again differently: that fix goes, the new words are about that card.
  const changed = handFromSpeech('Estou no botão com ás rei. O UTG abre para 1000, eu pago. Flop dama sete dois.', base()).hand;
  assert.deepEqual(liveFixes(changed, fixes), {});
  assert.equal(withFixes(changed, fixes).board[0], changed.board[0]);
});

test('a fixed card already in use elsewhere trades places with it', () => {
  const h = handFromSpeech('Estou no botão com ás rei. O UTG abre para 1000, eu pago. Flop rei sete dois.', base()).hand;
  const hero = h.players[h.hero].cards!;
  // Hero's ace becomes the flop's seven: the seven goes where the ace was.
  const fixed = withFixes(h, { h0: { from: hero[0], to: h.board[1] } });
  assert.equal(fixed.players[fixed.hero].cards![0], h.board[1]);
  assert.equal(fixed.board[1], hero[0]);
});
