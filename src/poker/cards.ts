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

/** "AKs", "QJo", "77" — the usual shorthand for a starting hand. */
export function comboLabel(cards?: CardCode[]): string {
  if (!cards || cards.length < 2) return '';
  const [a, b] = [...cards].sort((x, y) => rankValue(y) - rankValue(x));
  if (a[0] === b[0]) return a[0] + b[0];
  return a[0] + b[0] + (a[1] === b[1] ? 's' : 'o');
}
