import type { GameInfo } from './types';

// Which poker is dealt. Hold'em is the default and what every hand saved before PLO
// existed is: no variant field means two hole cards and no-limit betting.

/** Pot-Limit Omaha: four hole cards, exactly two of them in the hand, bets capped at the pot. */
export function isPLO(game: Pick<GameInfo, 'variant'>): boolean {
  return game.variant === 'plo';
}

/** Hole cards each player is dealt: 4 in PLO, 2 in hold'em. */
export function holeCount(game: Pick<GameInfo, 'variant'>): number {
  return isPLO(game) ? 4 : 2;
}

/** The game a session or tournament is, as its money is grouped: by name, or by the hands saved in it. */
export type GameName = 'NLH' | 'PLO' | 'PLO8' | 'Mix' | 'Short Deck';

/**
 * The game from a name the player or a festival wrote. Whole words only, so «Explorer Cup» stays hold'em.
 * PLO8 (hi-lo, split pot) is its own game; NLO, FLO and PLO5/6 count as PLO. No game named means hold'em.
 */
export function gameOfName(name: string): GameName {
  const n = name ?? '';
  if (/\b(mix(ed)?|h\.?o\.?r\.?s\.?e\.?|[0-9]+[- ]?game|dealer'?s? choice|stud|razz|2-7|triple draw|badugi|o\.?e\.?)\b/i.test(n)) return 'Mix';
  if (/\b([npf]lo ?-?8|o-?8|([npf]lo|omaha) ?hi ?[-/]? ?lo|omaha ?8|big ?o)\b/i.test(n)) return 'PLO8';
  if (/\b([npf]lo[456]?|omaha)\b/i.test(n)) return 'PLO';
  if (/short ?deck|\b6\+/i.test(n)) return 'Short Deck';
  return 'NLH';
}

/**
 * A session's game: when most of its saved hands are PLO and the name says nothing else, it is PLO.
 * `plo` and `all` count the session's hands.
 */
export function sessionGame(name: string, plo = 0, all = 0): GameName {
  const g = gameOfName(name);
  return g === 'NLH' && all > 0 && plo * 2 > all ? 'PLO' : g;
}

/** PLO hands and all hands per session id, for `sessionGame`. */
export function handCounts(hands: { sessionId?: string; game: Pick<GameInfo, 'variant'> }[]): Map<string, { plo: number; all: number }> {
  const m = new Map<string, { plo: number; all: number }>();
  for (const h of hands) {
    if (!h.sessionId) continue;
    const c = m.get(h.sessionId) ?? { plo: 0, all: 0 };
    c.all++;
    if (isPLO(h.game)) c.plo++;
    m.set(h.sessionId, c);
  }
  return m;
}
