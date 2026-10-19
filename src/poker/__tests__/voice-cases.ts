// Hands told the way players tell them, with what the app must make of them. Each
// sentence came from a QA round (or a report a player could make); voice.test.ts
// runs them all, and `npx tsx src/poker/__tests__/voice-cases.ts` prints the hit rate per language.

import { positions, replay } from '../engine';
import type { GameInfo, Hand } from '../types';
import { handFromSpeech } from '../voice';

export type Lang = 'pt' | 'br' | 'es' | 'en';

export interface Case {
  lang: Lang;
  text: string;
  /** Hero's position. */
  pos?: string;
  /** Hero's cards: ranks ("AK") or exact cards ("AhKh"). */
  cards?: string;
  /** Every bet, raise and call in order ("UTG r1000, BTN c"); folds and checks left out. */
  line?: string;
  /** The board's ranks ("K72A"). */
  board?: string;
  /** Cards shown, by position: { UTG: 'QJ' }. */
  shows?: Record<string, string>;
  /** Stacks by position, in chips. */
  stacks?: Record<string, number>;
  /** Note codes that must not show up. */
  noNotes?: string[];
  /** The hand ends with everyone else folded. */
  foldWin?: boolean;
  game?: GameInfo;
  n?: number;
}

export const MTT: GameInfo = { kind: 'mtt', name: 'T', sb: 200, bb: 400, ante: 400, anteType: 'bb', currency: '€' };
export const CASH: GameInfo = { kind: 'cash', name: '', sb: 1, bb: 2, ante: 0, anteType: 'none', currency: '€' };

export function base(game: GameInfo = MTT, n = 9): Hand {
  const stack = game.bb * 100;
  return {
    v: 1, id: 't', createdAt: 0, updatedAt: 0, game,
    players: Array.from({ length: n }, (_, i) => ({ name: i ? '' : 'Hero', stack })),
    button: 0, hero: 0, actions: [], board: [], tags: [], notes: '',
  };
}

export function line(h: Hand) {
  const pos = positions(h.players.length, h.button);
  return h.actions
    .filter((a) => a.kind !== 'fold' && a.kind !== 'check')
    .map((a) => `${pos[a.p]} ${a.kind[0]}${a.to ?? ''}`)
    .join(', ');
}

const ranks = (cards: string[] | undefined) => (cards ?? []).map((c) => c[0]).join('');

/** What's wrong with the app's reading of a case, or null when it's right. */
export function check(c: Case): string | null {
  const r = handFromSpeech(c.text, base(c.game, c.n));
  const h = r.hand;
  const pos = positions(h.players.length, h.button);
  const wrong: string[] = [];
  if (c.pos && pos[h.hero] !== c.pos) wrong.push(`pos ${pos[h.hero]} ≠ ${c.pos}`);
  if (c.cards) {
    const got = h.players[h.hero].cards ?? [];
    const exact = c.cards.length === 4 && /[shdc]/.test(c.cards[1]);
    const g = exact ? got.join('') : ranks(got);
    if (g !== c.cards && !(!exact && [...g].reverse().join('') === c.cards)) wrong.push(`cards ${g || '-'} ≠ ${c.cards}`);
  }
  if (c.line !== undefined && line(h) !== c.line) wrong.push(`line "${line(h)}" ≠ "${c.line}"`);
  if (c.board !== undefined && ranks(h.board) !== c.board) wrong.push(`board ${ranks(h.board) || '-'} ≠ ${c.board}`);
  for (const [p, want] of Object.entries(c.shows ?? {})) {
    const got = ranks(h.players[pos.indexOf(p)]?.cards);
    if (got !== want && [...got].reverse().join('') !== want) wrong.push(`${p} shows ${got || '-'} ≠ ${want}`);
  }
  for (const [p, want] of Object.entries(c.stacks ?? {})) {
    const got = h.players[pos.indexOf(p)]?.stack;
    if (got !== want) wrong.push(`${p} stack ${got} ≠ ${want}`);
  }
  if (c.foldWin !== undefined && !!replay(h).final.foldWin !== c.foldWin) wrong.push(`foldWin ≠ ${c.foldWin}`);
  for (const code of c.noNotes ?? []) if (r.notes.some((x) => x.code === code)) wrong.push(`note ${code}`);
  return wrong.length ? wrong.join('; ') : null;
}

export const CASES: Case[] = [
  // ── «fold até…»: everyone before that seat folds, and only them.
  { lang: 'pt', text: 'Estou no botão com ás rei. Fold até ao cutoff, ele abre para 1000 e eu pago.', pos: 'BTN', cards: 'AK', line: 'CO r1000, BTN c' },
  { lang: 'pt', text: 'Fold até o cutoff, o cutoff abre para 1000, eu no botão pago com valete dez.', pos: 'BTN', cards: 'JT', line: 'CO r1000, BTN c' },
  { lang: 'br', text: 'Tô no botão com dama dama. Fold até o cutoff, ele abre pra 1000, eu dou 3bet pra 3000, ele paga.', pos: 'BTN', cards: 'QQ', line: 'CO r1000, BTN r3000, CO c' },
  { lang: 'br', text: 'Todo mundo folda até mim no botão, abro pra 1000 com ás dama e o big paga.', pos: 'BTN', cards: 'AQ', line: 'BTN r1000, BB c' },
  { lang: 'es', text: 'Estoy en el botón con as rey. Todos foldean hasta el cutoff, sube a 1000 y yo pago.', pos: 'BTN', cards: 'AK', line: 'CO r1000, BTN c' },
  { lang: 'en', text: 'Folds to the button, I open to 1000 with ace king and the big blind calls.', pos: 'BTN', cards: 'AK', line: 'BTN r1000, BB c' },
  { lang: 'en', text: "I'm on the button with queen jack. Folds to the cutoff, he opens to 1000 and I call.", pos: 'BTN', cards: 'QJ', line: 'CO r1000, BTN c' },

  // ── «passa, passa»: two checks, by whoever is to act.
  { lang: 'pt', text: 'Estou no big com nove oito de copas. O botão abre para 1000, eu pago. Flop rei sete dois, passa, passa. Turn dois, passa, passa. River ás, aposto 2000 e ele foge.', pos: 'BB', cards: '98', line: 'BTN r1000, BB c, BB b2000', board: 'K722A', noNotes: ['boardMissing'] },
  { lang: 'es', text: 'Estoy en la ciega grande con siete ocho. La pequeña sube a 1200 y yo pago. Flop rey siete dos, pasa, pasa. Turn tres, pasa, aposté 2000 y él pagó.', pos: 'BB', cards: '78', line: 'SB r1200, BB c, BB b2000, SB c', board: 'K723', noNotes: ['boardMissing'] },
  { lang: 'br', text: 'Tô no botão com valete valete, o UTG abre pra 1000, eu pago. Flop dez seis três, passa, passa. Turn ás, ele aposta 2000, eu pago.', pos: 'BTN', cards: 'JJ', line: 'UTG r1000, BTN c, UTG b2000, BTN c', board: 'T63A', noNotes: ['boardMissing'] },
  { lang: 'es', text: 'Estoy en el botón con dama jota. El UTG sube a 1000, pago. Flop as siete dos, paso, él pasa. Turn rey.', pos: 'BTN', cards: 'QJ', line: 'UTG r1000, BTN c', board: 'A72K', noNotes: ['boardMissing', 'skipped'] },
  // A straddle: the hand still reaches the flop.
  { lang: 'pt', text: 'Cash com straddle de 4. Estou no botão com ás dez, o cutoff abre para 12, eu pago, o straddle paga. Flop dez oito dois, passa, passa, passa.', pos: 'BTN', cards: 'AT', line: 'CO r12, BTN c, UTG c', board: 'T82', noNotes: ['boardMissing'], game: CASH },

  // ── The ace: «ás rei» with no cue, and two cards each with its suit.
  { lang: 'pt', text: 'Botão, ás rei. O UTG abre para 1000, eu pago.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN c' },
  { lang: 'pt', text: 'Ás rei no botão, o UTG abre para 1000 e eu pago.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN c' },
  { lang: 'pt', text: 'Estou no botão com o ás de copas e o rei de copas, o UTG abre para 1000, eu pago.', pos: 'BTN', cards: 'AhKh', line: 'UTG r1000, BTN c' },
  { lang: 'es', text: 'Estoy en el botón con el siete y el ocho de picas. El UTG sube a 1000, pagué.', pos: 'BTN', cards: '7s8s', line: 'UTG r1000, BTN c' },
  { lang: 'en', text: "I'm on the button with the seven and eight of spades, UTG opens to 1000 and I call.", pos: 'BTN', cards: '7s8s', line: 'UTG r1000, BTN c' },
  { lang: 'br', text: 'Botão, ás rei, o UTG abre pra 1000 e eu pago.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN c' },

  // ── English hundreds.
  { lang: 'en', text: "I'm on the button with ace king. UTG opens to twelve hundred, I three-bet to three thousand five hundred and he calls.", pos: 'BTN', cards: 'AK', line: 'UTG r1200, BTN r3500, UTG c' },
  { lang: 'en', text: "I'm in the big blind with nine eight. The button opens to eleven hundred and I call.", pos: 'BB', cards: '98', line: 'BTN r1100, BB c' },
  { lang: 'en', text: "I'm on the button with ace queen. UTG opens to two thousand five hundred and I call.", pos: 'BTN', cards: 'AQ', line: 'UTG r2500, BTN c' },
  { lang: 'en', text: "Cash game, I'm on the button with king queen. UTG opens to five hundred and I call.", pos: 'BTN', cards: 'KQ', line: 'UTG r500, BTN c', game: CASH },

  // ── The blinds without an article.
  { lang: 'pt', text: 'Estou de big com sete sete. Small abre para 1200, eu pago.', pos: 'BB', cards: '77', line: 'SB r1200, BB c' },
  { lang: 'pt', text: 'Estou no small com cinco quatro. UTG paga, botão paga, eu completo, big passa.', pos: 'SB', cards: '54', line: 'UTG c, BTN c, SB c' },
  { lang: 'br', text: 'Tô de small com A 5 de espadas. Todo mundo folda até mim, eu completo, o big passa.', pos: 'SB', cards: 'As5s', line: 'SB c' },
  { lang: 'br', text: 'Tô de big com dez nove. Botão abre pra 1000, small paga, eu pago.', pos: 'BB', cards: 'T9', line: 'BTN r1000, SB c, BB c' },
  { lang: 'es', text: 'Estoy de ciega grande con as cinco. La pequeña sube a 1200 y pago.', pos: 'BB', cards: 'A5', line: 'SB r1200, BB c' },
  { lang: 'es', text: 'Estoy en el botón con rey dama, subo a 1000, la pequeña se retira y la grande paga.', pos: 'BTN', cards: 'KQ', line: 'BTN r1000, BB c' },

  // ── A stack said without the word «stack».
  { lang: 'pt', text: 'Estou no botão com A K, 15 bb. O UTG abre para 1000, eu vou all-in e ele paga.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN r6000, UTG c', stacks: { BTN: 6000 } },
  { lang: 'br', text: 'Tô no botão com 40k e ás rei. O UTG abre pra 1000, eu vou all-in, ele paga.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN r40000, UTG c', stacks: { BTN: 40000 } },
  { lang: 'es', text: 'Estamos con 15 ciegas efectivas, estoy en el botón con as rey. El UTG sube a 1000, voy all in y paga.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN r6000, UTG c', stacks: { BTN: 6000 } },
  { lang: 'en', text: "I'm on the button with ace king, 15 big blinds. UTG opens to 1000, I shove and he calls.", pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN r6000, UTG c', stacks: { BTN: 6000 } },

  // ── Everyone / both.
  { lang: 'br', text: 'Tô no botão com ás rei, abro pra 1000 e todo mundo corre.', pos: 'BTN', cards: 'AK', line: 'BTN r1000' },
  { lang: 'pt', text: 'Estou no botão com ás rei, abro para 1000 e os dois pagam.', pos: 'BTN', cards: 'AK', line: 'BTN r1000, SB c, BB c' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1000 y los dos pagan.', pos: 'BTN', cards: 'AK', line: 'BTN r1000, SB c, BB c' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1000 y todos se retiran.', pos: 'BTN', cards: 'AK', line: 'BTN r1000' },
  { lang: 'en', text: "I'm on the button with ace queen and open to 1000, both call.", pos: 'BTN', cards: 'AQ', line: 'BTN r1000, SB c, BB c' },

  // ── Spanish showdowns and past tenses.
  { lang: 'es', text: 'Estoy en el botón con dama dama. El UTG sube a 1000, pagué. Flop nueve cinco dos, apuesta 1500, pagué. Turn tres, pasé, pasó. River siete, aposté 3000 y pagó. Él tenía as rey.', pos: 'BTN', cards: 'QQ', line: 'UTG r1000, BTN c, UTG b1500, BTN c, BTN b3000, UTG c', board: '95237', shows: { UTG: 'AK' } },
  { lang: 'es', text: 'Estoy en el botón con as rey. El UTG sube a 1000 y pago. Flop as siete dos, apuesta 1500 y pago. Turn tres, river cuatro. Muestra pareja de dieces.', pos: 'BTN', cards: 'AK', board: 'A7234', shows: { UTG: 'TT' } },

  // ── English verbs.
  { lang: 'en', text: "I'm in the big blind with seven deuce. Small blind completes and I check.", pos: 'BB', cards: '72', line: 'SB c' },
  { lang: 'en', text: "UTG opens to 1000, I'm in the cutoff with jacks and three-bet to 3000, UTG calls.", pos: 'CO', cards: 'JJ', line: 'UTG r1000, CO r3000, UTG c' },
  { lang: 'en', text: 'Hero is on the button with king queen and opens to 900, the big blind calls.', pos: 'BTN', cards: 'KQ', line: 'BTN r900, BB c' },
  { lang: 'pt', text: 'O UTG faz minraise, eu pago no botão com ás rei.', pos: 'BTN', cards: 'AK', line: 'UTG r800, BTN c' },
  { lang: 'br', text: 'Tô no botão com rei rei. O UTG abre pra 1000, eu pago. Flop ás oito três, ele dá mesa, eu dou mesa. Turn dois, mesa, mesa.', pos: 'BTN', cards: 'KK', line: 'UTG r1000, BTN c', board: 'A832', noNotes: ['boardMissing'] },

  // ── Everyone else folds: «toda a gente», «ninguém paga».
  { lang: 'pt', text: 'Estou no UTG com ás rei, abro para seis, toda a gente desiste.', pos: 'UTG', cards: 'AK', line: 'UTG r2400', foldWin: true },
  { lang: 'pt', text: 'Estou no UTG com ás rei, abro para seis e ninguém paga.', pos: 'UTG', cards: 'AK', line: 'UTG r2400', foldWin: true },
  { lang: 'es', text: 'Estoy en UTG con as rey, subo a seis y nadie paga.', pos: 'UTG', cards: 'AK', line: 'UTG r2400', foldWin: true },
  { lang: 'en', text: 'I am UTG with ace king, I open to six and nobody calls.', pos: 'UTG', cards: 'AK', line: 'UTG r2400', foldWin: true },

  // ── Línguas' round: «me» against hero, «ciega chica», «veo», the currency before the number.
  { lang: 'br', text: 'Tô no botão com ás rei, abro pra 1200, o big me dá 3-bet pra 3600, eu pago.', pos: 'BTN', cards: 'AK', line: 'BTN r1200, BB r3600, BTN c' },
  { lang: 'pt', text: 'Estou no botão com ás rei, abro para 1200, o big dá-me 3-bet para 3600, eu pago.', pos: 'BTN', cards: 'AK', line: 'BTN r1200, BB r3600, BTN c' },
  { lang: 'pt', text: 'Estou no botão com ás rei, abro para 1200, o big faz-me 3-bet para 3600, eu pago.', pos: 'BTN', cards: 'AK', line: 'BTN r1200, BB r3600, BTN c' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1200, la ciega grande me sube a 3600, pago.', pos: 'BTN', cards: 'AK', line: 'BTN r1200, BB r3600, BTN c' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1200, la ciega grande me hace 3bet a 3600, pago.', pos: 'BTN', cards: 'AK', line: 'BTN r1200, BB r3600, BTN c' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1200, la ciega grande me pone all in, pago.', pos: 'BTN', cards: 'AK', line: 'BTN r1200, BB r39600, BTN c' },
  { lang: 'es', text: 'Estoy en la ciega chica con as rey, el botón sube a 1000, pago.', pos: 'SB', cards: 'AK', line: 'BTN r1000, SB c' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1000, la ciega grande paga. Flop rey siete dos, apuesta 600, yo lo veo.', pos: 'BTN', line: 'BTN r1000, BB c, BB b600, BTN c', board: 'K72' },
  { lang: 'en', text: 'I am on the button with ace king, UTG raises to $2,500, I call.', pos: 'BTN', cards: 'AK', line: 'UTG r2500, BTN c' },
  { lang: 'en', text: 'I am on the button with ace king, UTG raises to €2500, I call.', pos: 'BTN', cards: 'AK', line: 'UTG r2500, BTN c' },
  { lang: 'es', text: 'Estoy en el botón con as rey, UTG sube a $2500, pago.', pos: 'BTN', cards: 'AK', line: 'UTG r2500, BTN c' },
  { lang: 'br', text: 'Tô no botão com ás rei, o UTG abre pra R$ 2.500, eu pago.', pos: 'BTN', cards: 'AK', line: 'UTG r2500, BTN c' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1000, la ciega grande paga. Flop rey siete dos, apuesto 1000, me paga.', pos: 'BTN', line: 'BTN r1000, BB c, BTN b1000, BB c', board: 'K72' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1000, la ciega grande paga. Flop rey siete dos. Veo que apuesta 600 y pago.', pos: 'BTN', line: 'BTN r1000, BB c, BB b600, BTN c', board: 'K72' },
  { lang: 'es', text: 'Estoy en el botón con as rey, subo a 1000, la ciega grande paga. Flop rey siete dos, apuesta 600, veo.', pos: 'BTN', line: 'BTN r1000, BB c, BB b600, BTN c', board: 'K72' },
  { lang: 'en', text: "Live 1/3. I'm on the button with jack ten suited. UTG+1 raises to 20, I call. Flop queen nine two, UTG+1 bets 25, I call.", game: CASH, pos: 'BTN', line: 'UTG+1 r20, BTN c, UTG+1 b25, BTN c', board: 'Q92' },
  { lang: 'br', text: 'Tô no botão com ás rei, o UTG abre pra R$2.500, eu pago.', pos: 'BTN', cards: 'AK', line: 'UTG r2500, BTN c' },
  { lang: 'en', text: "Live 1/3 with a 6 dollar straddle. I'm on the button with jack ten suited. UTG+1 raises to 20, I call.", game: CASH, pos: 'BTN', cards: 'JT', line: 'UTG+1 r20, BTN c' },
  { lang: 'en', text: "I'm on the button with big slick, UTG opens to 1000, I call.", pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN c' },

  // ── P3s.
  { lang: 'pt', text: 'Blinds 400/200. Estou no botão com ás rei, o UTG abre para 1000, eu pago.', pos: 'BTN', cards: 'AK', line: 'UTG r1000, BTN c' },
];

if (typeof require !== 'undefined' && require.main === module) {
  const by: Record<string, [number, number]> = {};
  for (const c of CASES) {
    const bad = check(c);
    by[c.lang] = by[c.lang] ?? [0, 0];
    by[c.lang][1]++;
    if (!bad) by[c.lang][0]++;
    else console.log(`✗ [${c.lang}] ${c.text}\n    ${bad}`);
  }
  for (const [l, [ok, all]] of Object.entries(by)) console.log(`${l}: ${ok}/${all} (${Math.round((ok / all) * 100)}%)`);
}
