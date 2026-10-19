// The odds screen's sum, kept out of the screen so it can be tested: hero against
// villain's cards or (hold'em only) a range, on the board dealt so far.

import { equity } from './equity';
import { equityVsRange, topRange } from './ranges';
import type { CardCode } from './types';

export type OddsGame = 'nlhe' | 'plo';

/** Hole cards each side holds: 4 in PLO, 2 in hold'em. */
export const oddsHole = (game: OddsGame) => (game === 'plo' ? 4 : 2);

/**
 * Hero's and villain's equity, or null while a hand is incomplete. PLO is cards against
 * cards only: the ranges are hold'em hands, so a range there would be a wrong number.
 */
export function oddsEquity(game: OddsGame, hero: CardCode[], villain: CardCode[], board: CardCode[], mode: 'range' | 'cards', rangePct: number): { hero: number; villain: number } | null {
  const n = oddsHole(game);
  if (hero.length < n) return null;
  if (mode === 'cards' || game === 'plo') {
    if (villain.length < n) return null;
    const [h, v] = equity([hero.slice(0, n), villain.slice(0, n)], board);
    return { hero: h, villain: v };
  }
  const e = equityVsRange(hero.slice(0, 2), topRange(rangePct), board);
  return e == null ? null : { hero: e, villain: 1 - e };
}
