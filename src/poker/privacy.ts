// What leaves the phone when a hand is shared. Opponents are third parties:
// their names (often nicknames from your notes) stay private unless you opt in.

import type { Hand } from './types';

export interface ShareOptions {
  /** Show opponents' names; off by default, they appear as positions. */
  names: boolean;
  /** Include your notes on the hand. */
  notes: boolean;
}

export const DEFAULT_SHARE: ShareOptions = { names: false, notes: true };

export function publicHand(hand: Hand, opts: ShareOptions = DEFAULT_SHARE): Hand {
  const { sessionId: _s, shareToken: _t, shareId: _i, voiceNote: _v, folders: _f, streetNotes: _n, review: _r, reviewNote: _rn, reviewedAt: _ra, ...rest } = hand;
  return {
    ...rest,
    players: hand.players.map(({ playerId: _p, ...p }, i) => (i === hand.hero || opts.names ? p : { ...p, name: '' })),
    notes: opts.notes ? hand.notes : '',
  } as Hand;
}
