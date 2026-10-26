/// <reference types="node" />
// Told after the hand: in the past tense, the way players tell it on the way out of the table
// (Rui's list, 26 Oct: the voice made for after the hand). Every hand must come out as it was played.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { check, type Case } from './voice-cases';

const AFTER: Case[] = [
  { lang: 'pt', text: 'Estava no botão com ás rei de copas. O UTG abriu para 1000, eu paguei. Flop rei sete dois, ele apostou 1500 e eu paguei.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN c, UTG b1500, BTN c', board: 'K72' },
  { lang: 'pt', text: 'Estava no big com dez nove. O botão abriu para 900 e eu defendi. Flop dez cinco dois, passei, ele apostou 1000, eu paguei.', pos: 'BB', cards: 'T9', line: 'BTN r900, BB c, BTN b1000, BB c', board: 'T52' },
  { lang: 'pt', text: 'Tinha dama dama no cutoff. Abri para 1100, o botão fez 3bet para 3500 e eu paguei. Flop ás oito três, passei e ele apostou 2500, larguei.', pos: 'CO', cards: 'QQ', line: 'CO r1100, BTN r3500, CO c, BTN b2500', board: 'A83' },
  { lang: 'pt', text: 'Estava no UTG com ás rei, abri para 1000, só o big pagou. Flop rei oito dois, ele passou, apostei 1200, ele pagou. Turn dois, passámos. River sete, ele apostou 3000 e eu paguei. Ele mostrou oito oito.', pos: 'UTG', cards: 'AK', line: 'UTG r1000, BB c, UTG b1200, BB c, BB b3000, UTG c', board: 'K8227', shows: { BB: '88' } },
  { lang: 'pt', text: 'Estava no botão com setes. O cutoff abriu para 1000, eu paguei e o big também. Flop sete cinco dois, o big passou, o cutoff apostou 1500, eu subi para 4500, só o cutoff pagou.', pos: 'BTN', cards: '77', line: 'CO r1000, BTN c, BB c, CO b1500, BTN r4500, CO c', board: '752' },
  { lang: 'pt', text: 'Estava no small com ás valete. Foldaram todos até mim, abri para 1000, o big pagou. Flop valete quatro três, apostei 800, ele foi all-in e eu paguei.', pos: 'SB', cards: 'AJ', line: 'SB r1000, BB c, SB b800, BB r38600, SB c', board: 'J43' },
  { lang: 'pt', text: 'Estava no hijack com rei dama, abri para 1100, o botão pagou. Flop dama dez quatro, apostei 1200, ele pagou. Turn ás, passei, ele apostou 3000, paguei. River dois, passámos os dois. Ganhei com dama.', pos: 'HJ', cards: 'KQ', line: 'HJ r1100, BTN c, HJ b1200, BTN c, BTN b3000, HJ c', board: 'QT4A2' },
  { lang: 'br', text: 'Tava no botão com ás dama. O UTG abriu pra 1000, eu paguei. Flop dama sete três, ele deu mesa, eu apostei 1500, ele pagou.', pos: 'BTN', cards: 'AQ', line: 'UTG r1000, BTN c, BTN b1500, UTG c', board: 'Q73' },
  { lang: 'br', text: 'Eu tava de big com oito sete, o botão abriu pra 900 e eu paguei. Flop oito sete dois, dei mesa, ele apostou 1000, eu aumentei pra 3500 e ele pagou.', pos: 'BB', cards: '87', line: 'BTN r900, BB c, BTN b1000, BB r3500, BTN c', board: '872' },
  { lang: 'br', text: 'Tava no cutoff com par de dez, abri pra 1100, o botão deu 3bet pra 3500, eu fui all-in e ele pagou.', pos: 'CO', cards: 'TT', line: 'CO r1100, BTN r3500, CO r40000, BTN c', board: '' },
  { lang: 'br', text: 'Tava no UTG com ás rei, abri pra 1000, o botão pagou. Flop rei nove dois, apostei 1200, ele pagou. Turn cinco, apostei 3000, ele largou.', pos: 'UTG', cards: 'AK', line: 'UTG r1000, BTN c, UTG b1200, BTN c, UTG b3000', board: 'K925' },
  { lang: 'br', text: 'Tava no big com nove oito, o small completou e eu dei mesa. Flop nove cinco dois, ele deu mesa, eu apostei 400 e ele pagou.', pos: 'BB', cards: '98', line: 'SB c, BB b400, SB c', board: '952' },
  { lang: 'es', text: 'Estaba en el botón con as rey de corazones. El UTG subió a 1000 y pagué. Flop rey siete dos, apostó 1500 y pagué.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN c, UTG b1500, BTN c', board: 'K72' },
  { lang: 'es', text: 'Estaba en la ciega grande con diez nueve. El botón subió a 900 y pagué. Flop diez cinco dos, pasé, apostó 1000 y pagué.', pos: 'BB', cards: 'T9', line: 'BTN r900, BB c, BTN b1000, BB c', board: 'T52' },
  { lang: 'es', text: 'Tenía dama dama en el cutoff. Subí a 1100, el botón resubió a 3500 y pagué. Flop as ocho tres, pasé, apostó 2500 y me retiré.', pos: 'CO', cards: 'QQ', line: 'CO r1100, BTN r3500, CO c, BTN b2500', board: 'A83' },
  { lang: 'es', text: 'Estaba en UTG con as rey, subí a 1000 y solo pagó la ciega grande. Flop rey ocho dos, pasó, aposté 1200 y pagó. Turn dos, pasamos. River siete, apostó 3000 y pagué. Enseñó ocho ocho.', pos: 'UTG', cards: 'AK', line: 'UTG r1000, BB c, UTG b1200, BB c, BB b3000, UTG c', board: 'K8227', shows: { BB: '88' } },
  { lang: 'es', text: 'Estaba en la ciega pequeña con as jota. Todos se retiraron, subí a 1000 y la grande pagó. Flop jota cuatro tres, aposté 800, fue all in y pagué.', pos: 'SB', cards: 'AJ', line: 'SB r1000, BB c, SB b800, BB r38600, SB c', board: 'J43' },
  { lang: 'es', text: 'Andaba en el botón con as dama, el UTG abrió a mil y se la pagué. Flop dama siete tres, checó, aposté 1500 y me la pagó.', pos: 'BTN', cards: 'AQ', line: 'UTG r1000, BTN c, BTN b1500, UTG c', board: 'Q73' },
  { lang: 'es', text: 'Estaba en la grande con ocho siete, el botón subió a 900 y la vi. Flop ocho siete dos, chequé, apostó mil y le subí a 3500, pagó.', pos: 'BB', cards: '87', line: 'BTN r900, BB c, BTN b1000, BB r3500, BTN c', board: '872' },
  { lang: 'es', text: 'Andaba en el cutoff con par de dieces, abrí a 1100, el botón me resubió a 3500 y me fui con todo, pagó.', pos: 'CO', cards: 'TT', line: 'CO r1100, BTN r3500, CO r40000, BTN c', board: '' },
  { lang: 'es', text: 'Estaba en UTG con as rey, abrí a mil, pagó el botón. Flop rey nueve dos, aposté 1200 y pagó. Turn cinco, aposté 3000 y se tiró.', pos: 'UTG', cards: 'AK', line: 'UTG r1000, BTN c, UTG b1200, BTN c, UTG b3000', board: 'K925' },
  { lang: 'en', text: 'I was on the button with ace king of hearts. UTG opened to 1000 and I called. Flop king seven two, he bet 1500 and I called.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN c, UTG b1500, BTN c', board: 'K72' },
  { lang: 'en', text: 'I was in the big blind with ten nine. The button opened to 900 and I defended. Flop ten five two, I checked, he bet 1000, I called.', pos: 'BB', cards: 'T9', line: 'BTN r900, BB c, BTN b1000, BB c', board: 'T52' },
  { lang: 'en', text: 'I had queens in the cutoff. I opened to 1100, the button three-bet to 3500 and I called. Flop ace eight three, I checked, he bet 2500, I folded.', pos: 'CO', cards: 'QQ', line: 'CO r1100, BTN r3500, CO c, BTN b2500', board: 'A83' },
  { lang: 'en', text: 'I was UTG with ace king, opened to 1000, only the big blind called. Flop king eight two, he checked, I bet 1200, he called. Turn two, we checked. River seven, he bet 3000 and I called. He showed eights.', pos: 'UTG', cards: 'AK', line: 'UTG r1000, BB c, UTG b1200, BB c, BB b3000, UTG c', board: 'K8227' },
  { lang: 'en', text: 'I was on the button with sevens. The cutoff opened to 1000, I called and so did the big blind. Flop seven five two, big blind checked, cutoff bet 1500, I raised to 4500, only the cutoff called.', pos: 'BTN', cards: '77', line: 'CO r1000, BTN c, BB c, CO b1500, BTN r4500, CO c', board: '752' },
];

test('hands told after they were played, in the past tense', () => {
  const wrong = AFTER.map((c) => [c.text, check(c)] as const).filter(([, w]) => w).map(([text, w]) => `${text} → ${w}`);
  assert.deepEqual(wrong, []);
});
