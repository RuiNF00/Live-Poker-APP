/// <reference types="node" />
// Mexican Spanish: hands and live updates told the way players in Mexico tell them
// («le subo», «me la paga», «checo», «me voy con todo», «kas», «el corte», «traigo 45 mil»).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { liveChanges, type LiveChange } from '../voice-live';
import { CASH, type Case, check } from './voice-cases';

const L = 'es';
const HANDS: Case[] = [
  // Verbs: «le subo», «la pago», «le hago call», «me tiro», «checo», «le meto».
  {
    lang: L,
    text: 'Ando en el botón con as rey, el UTG abre a mil, le subo a tres mil y me la paga.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN r3000, UTG c',
  },
  {
    lang: L,
    text: 'Estaba de botón con as rey, el UTG sube a 1000, se la pago.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, le hago call.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, le doy call.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, la pago. Flop rey siete dos, checa, le apuesto 1500, me la paga.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c, BTN b1500, UTG c',
    board: 'K72',
  },
  {
    lang: L,
    text: 'Estoy en la ciega grande con nueve ocho, el botón abre a 1000, pago. Flop rey siete dos, checo, él betea 1200, me tiro.',
    pos: 'BB',
    cards: '98',
    line: 'BTN r1000, BB c, BTN b1200',
    board: 'K72',
  },
  {
    lang: L,
    text: 'Estoy en la grande con nueve ocho, el botón abre a 1000, igualo. Flop rey siete dos, le doy check, apuesta 1200, foldeo.',
    pos: 'BB',
    cards: '98',
    line: 'BTN r1000, BB c, BTN b1200',
    board: 'K72',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, le meto 3bet a 3000, se tira.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN r3000',
    foldWin: true,
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, le resubo a 3000, me paga.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN r3000, UTG c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, me voy con todo y me paga.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN r40000, UTG c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, empujo y me paga.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN r40000, UTG c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG se va con todo, se la pago.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r40000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, subo a 1000, la chica se tira, la grande me paga.',
    pos: 'BTN',
    cards: 'AK',
    line: 'BTN r1000, BB c',
  },
  {
    lang: L,
    text: 'Estoy en la chica con as cinco, todos se tiran hasta mí, completo, la grande checa.',
    pos: 'SB',
    cards: 'A5',
    line: 'SB c',
  },
  // Cards: «ka», «ases», «kas», «pocket», «suiteadas», «del mismo palo», «jotas».
  {
    lang: L,
    text: 'Estoy en el botón con as ka, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con pocket de ases, el UTG sube a 1000, le subo a 3000, paga.',
    pos: 'BTN',
    cards: 'AA',
    line: 'UTG r1000, BTN r3000, UTG c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con par de jotas, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'JJ',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con kas, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'KK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con reina jota suiteadas, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'QJ',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as y ka de diamantes, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'AdKd',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con la qu y la jota de tréboles, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'QcJc',
    line: 'UTG r1000, BTN c',
  },
  // Numbers: «mil quinientos», «un k», «quince mil», «dos mil y pico».
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a mil quinientos, pago. Flop rey siete dos, apuesta dos mil, pago.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1500, BTN c, UTG b2000, BTN c',
    board: 'K72',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 2.5 k, pago.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r2500, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, traigo quince ciegas, el UTG sube a 1000, me voy all in, paga.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN r6000, UTG c',
    stacks: { BTN: 6000 },
  },
  {
    lang: L,
    text: 'Ando con 20 mil, estoy en el botón con as rey, el UTG sube a 1000, voy all in, paga.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN r20000, UTG c',
    stacks: { BTN: 20000 },
  },
  // Cash in pesos.
  {
    lang: L,
    text: 'Cash de 25/50 pesos. Estoy en el botón con as reina, el UTG sube a 150, pago.',
    game: { ...CASH, sb: 25, bb: 50 },
    pos: 'BTN',
    cards: 'AQ',
    line: 'UTG r150, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as reina, el UTG sube a $150, pago, la grande paga. Flop as nueve cuatro, checan, apuesto 200, se tiran los dos.',
    game: { ...CASH, sb: 25, bb: 50 },
    pos: 'BTN',
    cards: 'AQ',
    line: 'UTG r150, BTN c, BB c, BTN b200',
    foldWin: true,
  },
  // Positions: «de botón», «en el corte», «en la chica», «en la grande», «primera posición».
  {
    lang: L,
    text: 'Estoy en el corte con as rey, el UTG sube a 1000, pago.',
    pos: 'CO',
    cards: 'AK',
    line: 'UTG r1000, CO c',
  },
  {
    lang: L,
    text: 'Estoy en primera posición con as rey, subo a 1000, el botón paga.',
    pos: 'UTG',
    cards: 'AK',
    line: 'UTG r1000, BTN c',
  },
  // Board said loosely: «cae», «sale», «el flop viene».
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, pago. El flop viene rey siete dos, checa, apuesto 1500, me paga. En el turn cae un tres, checa, checo. River cuatro.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c, BTN b1500, UTG c',
    board: 'K7234',
  },
  // Showdown: «enseña», «tenía», «voltea».
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, pago. Flop rey siete dos, apuesta 1500, pago. Turn tres, river cuatro. Enseña reina reina.',
    pos: 'BTN',
    cards: 'AK',
    board: 'K7234',
    shows: { UTG: 'QQ' },
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 1000, pago. Flop rey siete dos, turn tres, river cuatro. Voltea jota jota.',
    pos: 'BTN',
    cards: 'AK',
    board: 'K7234',
    shows: { UTG: 'JJ' },
  },
  // Corrections: «no, perdón», «bueno, 1200».
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 900, no, perdón, a 1100, pago.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1100, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 900, bueno, a 1100, pago.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1100, BTN c',
  },
  // «nadie paga», «todos se tiran».
  {
    lang: L,
    text: 'Estoy en UTG con as rey, subo a 1000 y todos se tiran.',
    pos: 'UTG',
    cards: 'AK',
    line: 'UTG r1000',
    foldWin: true,
  },
  {
    lang: L,
    text: 'Estoy en UTG con as rey, subo a 1000 y nadie me paga.',
    pos: 'UTG',
    cards: 'AK',
    line: 'UTG r1000',
    foldWin: true,
  },
  // Línguas' round: the forms most heard at Mexican tables.
  {
    lang: L,
    text: 'Estoy en el botón con la cu y la jota de tréboles, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'QcJc',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con par de reyes, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'KK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con dos reyes, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'KK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con reyes, el UTG sube a 1000, pago.',
    pos: 'BTN',
    cards: 'KK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con par de ases, el UTG sube a 1000, le subo a 3000, paga.',
    pos: 'BTN',
    cards: 'AA',
    line: 'UTG r1000, BTN r3000, UTG c',
  },
  {
    lang: L,
    text: 'Estoy en el cutoff con as rey, el UTG sube a 1000, pago.',
    pos: 'CO',
    cards: 'AK',
    line: 'UTG r1000, CO c',
  },
  {
    lang: L,
    text: 'Estoy en el CO con as rey, el UTG sube a 1000, pago.',
    pos: 'CO',
    cards: 'AK',
    line: 'UTG r1000, CO c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a mil, la veo.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a mil, te veo.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a mil, voy.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1000, BTN c',
  },
  {
    lang: L,
    text: 'Estoy en la grande con as rey, el botón sube a mil, voy. Flop rey siete dos, paso, apuesta 1200, voy.',
    pos: 'BB',
    cards: 'AK',
    line: 'BTN r1000, BB c, BTN b1200, BB c',
    board: 'K72',
  },
  {
    lang: L,
    text: 'Estoy en la grande con nueve ocho, el botón sube a mil, pago. Flop rey siete dos, paso, apuesta 1200, me retiro.',
    pos: 'BB',
    cards: '98',
    line: 'BTN r1000, BB c, BTN b1200',
    board: 'K72',
  },
  {
    lang: L,
    text: 'Estoy en la grande con nueve ocho, el botón sube a mil, pago. Flop rey siete dos, paso, apuesta 1200, me voy.',
    pos: 'BB',
    cards: '98',
    line: 'BTN r1000, BB c, BTN b1200',
    board: 'K72',
  },
  {
    lang: L,
    text: 'Estoy en el botón con as rey, el UTG sube a 900, más bien a 1100, pago.',
    pos: 'BTN',
    cards: 'AK',
    line: 'UTG r1100, BTN c',
  },
];

const LIVE: [string, LiveChange[]][] = [
  ['Traigo 45 mil', [{ k: 'stack', v: 45000 }]],
  ['Ando con 30 ciegas', [{ k: 'stack', v: 30, inBB: true }]],
  ['Me quedan 18 mil', [{ k: 'stack', v: 18000 }]],
  [
    'Nivel 12, traigo 45 mil',
    [
      { k: 'level', v: 12 },
      { k: 'stack', v: 45000 },
    ],
  ],
  ['Ya subieron las ciegas', [{ k: 'levelStep', dir: 1 }]],
  ['Cambió el nivel', [{ k: 'levelStep', dir: 1 }]],
  ['Quedamos 80', [{ k: 'left', v: 80 }]],
  ['Quedan 45 jugadores', [{ k: 'left', v: 45 }]],
  ['Somos 130 inscritos', [{ k: 'entries', v: 130 }]],
  ['Me recompré', [{ k: 'rebuy' }]],
  ['Hice reentry, traigo 40 mil', [{ k: 'rebuy' }, { k: 'stack', v: 40000 }]],
  ['Compré el add on', [{ k: 'addon' }]],
  ['Nos vamos al break', [{ k: 'pause' }]],
  ['Estamos en el descanso', [{ k: 'pause' }]],
  ['Ya regresé', [{ k: 'resume' }]],
  ['Ciegas 600/1200 ante 1200', [{ k: 'blinds', sb: 600, bb: 1200, ante: 1200 }]],
  ['Traigo 30 mil, no, 32 mil', [{ k: 'stack', v: 32000 }]],
  ['Anota: el de la silla 3 paga todo', [{ k: 'note', text: 'el de la silla 3 paga todo' }]],
  ['No me recompré', []],
  ['No hay break', []],
  ['Subieron las ciegas', [{ k: 'levelStep', dir: 1 }]],
  ['Tengo 45 mil', [{ k: 'stack', v: 45000 }]],
  ['Hice rebuy', [{ k: 'rebuy' }]],
];

test('es-MX: hands', () => {
  const wrong = HANDS.map((c) => [c.text, check(c)]).filter(([, bad]) => bad);
  assert.deepEqual(wrong, []);
});

test('es-MX: between hands', () => {
  const wrong = LIVE.filter(([text, want]) => JSON.stringify(liveChanges(text)) !== JSON.stringify(want)).map(([text]) => `${text} → ${JSON.stringify(liveChanges(text))}`);
  assert.deepEqual(wrong, []);
});
