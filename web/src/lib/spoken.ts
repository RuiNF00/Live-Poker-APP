// What a screen reader says for the shared-hand table: whole sentences, not the badges on screen.
// "Vilão no BTN faz raise para 2,5 BB", "Flop: Dama de ouros, Sete de copas, Três de copas".
import type { ActionType, AmountMode, ReplayStep, SeatState } from '@livepoker/hand-format';
import { describeStep, formatAmount, streetLabel } from './hand-i18n';
import { cardLabel, hiddenCardLabel } from './card-name';
import type { Locale } from './i18n';

type Words = {
  who: string;
  act: Partial<Record<ActionType, string>>;
  allIn: string;
  folded: string;
  inFront: string;
  wins: string;
  and: string;
  pot: string;
  board: string;
};

const PT: Words = {
  who: '{name} no {pos}',
  act: {
    post_sb: '{who} põe a small blind de {amt}',
    post_bb: '{who} põe a big blind de {amt}',
    post_ante: '{who} põe o ante de {amt}',
    post_straddle: '{who} faz straddle de {amt}',
    fold: '{who} faz fold',
    check: '{who} faz check',
    call: '{who} paga {amt}',
    bet: '{who} faz bet de {amt}',
    raise: '{who} faz raise para {amt}',
    allin: '{who} vai all-in com {amt}',
  },
  allIn: 'all-in',
  folded: 'fez fold',
  inFront: 'em jogo',
  wins: 'ganha',
  and: 'e',
  pot: 'Pote',
  board: 'Mesa',
};

const WORDS: Record<Locale, Words> = {
  pt: PT,
  'pt-BR': {
    ...PT,
    act: {
      ...PT.act,
      post_sb: '{who} coloca o small blind de {amt}',
      post_bb: '{who} coloca o big blind de {amt}',
      post_ante: '{who} paga o ante de {amt}',
      check: '{who} dá check',
      bet: '{who} dá bet de {amt}',
      raise: '{who} dá raise para {amt}',
    },
    board: 'Mesa',
  },
  en: {
    who: '{name} on the {pos}',
    act: {
      post_sb: '{who} posts the small blind, {amt}',
      post_bb: '{who} posts the big blind, {amt}',
      post_ante: '{who} posts the ante, {amt}',
      post_straddle: '{who} straddles {amt}',
      fold: '{who} folds',
      check: '{who} checks',
      call: '{who} calls {amt}',
      bet: '{who} bets {amt}',
      raise: '{who} raises to {amt}',
      allin: '{who} goes all-in for {amt}',
    },
    allIn: 'all-in',
    folded: 'folded',
    inFront: 'in front',
    wins: 'wins',
    and: 'and',
    pot: 'Pot',
    board: 'Board',
  },
  es: {
    who: '{name} en el {pos}',
    act: {
      post_sb: '{who} pone la ciega pequeña de {amt}',
      post_bb: '{who} pone la ciega grande de {amt}',
      post_ante: '{who} pone el ante de {amt}',
      post_straddle: '{who} hace straddle de {amt}',
      fold: '{who} hace fold',
      check: '{who} hace check',
      call: '{who} paga {amt}',
      bet: '{who} hace bet de {amt}',
      raise: '{who} hace raise a {amt}',
      allin: '{who} va all-in con {amt}',
    },
    allIn: 'all-in',
    folded: 'hizo fold',
    inFront: 'en juego',
    wins: 'gana',
    and: 'y',
    pot: 'Bote',
    board: 'Mesa',
  },
};

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

/** "Vilão no BTN", or just "BTN" when the player has no name. */
export function spokenWho(seat: Pick<SeatState, 'name' | 'position'>, locale: Locale): string {
  return seat.name && seat.name !== seat.position ? fill(WORDS[locale].who, { name: seat.name, pos: seat.position }) : seat.position;
}

const cards = (cs: string[], locale: Locale) => cs.map((c) => cardLabel(c, locale)).join(', ');

/** The step as one sentence: the action, the new street with its cards, or who won. */
export function spokenStep(step: ReplayStep, bb: number, mode: AmountMode, locale: Locale): string {
  const w = WORDS[locale];
  if (step.kind === 'street') {
    const fresh = step.street === 'flop' ? step.board.slice(0, 3) : step.board.slice(-1);
    return `${streetLabel(step.street, locale)}: ${cards(fresh, locale)}`;
  }
  if (step.kind === 'action' && step.action) {
    const a = step.action;
    const seat = step.seats.find((s) => s.seat === a.seat);
    const tpl = w.act[a.type];
    if (seat && tpl) return fill(tpl, { who: spokenWho(seat, locale), amt: formatAmount(a.type === 'call' ? a.paid : a.toAmount, bb, mode, locale) });
  }
  return describeStep(step, bb, mode, locale);
}

/** One seat: who, stack, what they did, their cards, what they won. */
export function spokenSeat(s: SeatState, fmt: (n: number) => string, locale: Locale, win?: number): string {
  const w = WORDS[locale];
  const bits = [spokenWho(s, locale), fmt(s.stack)];
  if (s.folded) bits.push(w.folded);
  else {
    if (s.allIn) bits.push(w.allIn);
    if (s.committed > 0) bits.push(`${fmt(s.committed)} ${w.inFront}`);
    bits.push(s.cards && s.showCards ? s.cards.map((c) => cardLabel(c, locale)).join(` ${w.and} `) : `2 × ${hiddenCardLabel(locale)}`);
    if (s.handLabel) bits.push(s.handLabel);
  }
  if (win) bits.push(`${w.wins} ${fmt(win)}`);
  return bits.join(', ');
}

/** "Mesa: …", or "Mesa 2: …" for one board of a run it twice. */
export function spokenBoard(board: string[], locale: Locale, run?: number): string {
  return `${WORDS[locale].board}${run ? ` ${run}` : ''}: ${cards(board, locale)}`;
}

export function spokenPot(amount: string, locale: Locale): string {
  return `${WORDS[locale].pot} ${amount}`;
}
