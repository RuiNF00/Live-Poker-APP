import { t } from '../i18n';

import type { CardCode, Suit } from './types';

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

export const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

export const FULL_DECK: CardCode[] = RANKS.flatMap((r) => SUITS.map((s) => r + s));

export function rankOf(c: CardCode): string {
  return c[0];
}

export function suitOf(c: CardCode): Suit {
  return c[1] as Suit;
}

/** 2..14 */
export function rankValue(c: CardCode): number {
  const r = c[0];
  return r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : r === 'T' ? 10 : Number(r);
}

export function displayRank(c: CardCode): string {
  return c[0] === 'T' ? '10' : c[0];
}

const RANK_NAME: Record<string, string> = { A: 'Ás', K: 'Rei', Q: 'Dama', J: 'Valete', T: 'Dez', '9': 'Nove', '8': 'Oito', '7': 'Sete', '6': 'Seis', '5': 'Cinco', '4': 'Quatro', '3': 'Três', '2': 'Dois' };
const SUIT_NAME: Record<Suit, string> = { s: 'espadas', h: 'copas', d: 'ouros', c: 'paus' };

/** A rank as a word: "Ás", "Rei", "Dez", "Sete" (never a digit or "T"). */
export function rankName(r: string): string {
  return RANK_NAME[r] ? t(RANK_NAME[r]) : r;
}

/**
 * "Ás de copas", "Dez de ouros", "Sete de paus": the card spelled out, for screen readers.
 * The one table every spoken card goes through (card picker, replayer, range sheet), so
 * a screen reader never mixes "10 de copas" with "Dez de copas" or "7" with "Sete".
 */
export function cardName(c: CardCode): string {
  return t('{rank} de {suit}', { rank: rankName(c[0]), suit: t(SUIT_NAME[suitOf(c)] ?? c[1]) });
}

/** "AKs", "QJo", "77" — the usual shorthand for a starting hand. */
export function comboLabel(cards?: CardCode[]): string {
  if (!cards || cards.length < 2) return '';
  const [a, b] = [...cards].sort((x, y) => rankValue(y) - rankValue(x));
  if (a[0] === b[0]) return a[0] + b[0];
  return a[0] + b[0] + (a[1] === b[1] ? 's' : 'o');
}
