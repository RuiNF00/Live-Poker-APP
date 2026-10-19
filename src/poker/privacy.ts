// What leaves the phone when a hand is shared. Opponents are third parties:
// their names (often nicknames from your notes) stay private unless you opt in.

import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH } from '../../packages/hand-format/src/validate';
import type { Hand } from './types';

/** The share page's limits (packages/hand-format/src/validate.ts), for the inputs that end up in a shared hand. */
export { MAX_NAME_LENGTH, MAX_NOTES_LENGTH };

export interface ShareOptions {
  /** Show opponents' names; off by default, they appear as positions. */
  names: boolean;
  /** Include your notes on the hand. */
  notes: boolean;
}

export const DEFAULT_SHARE: ShareOptions = { names: false, notes: false };

/** At most `max` UTF-16 units, as the validator counts, without leaving half an emoji at the end. */
function cut(s: string | undefined, max: number): string | undefined {
  if (s === undefined || s.length <= max) return s;
  const out = s.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(out) ? out.slice(0, -1) : out;
}

export function publicHand(hand: Hand, opts: ShareOptions = DEFAULT_SHARE): Hand {
  const { sessionId: _s, shareToken: _t, shareId: _i, voiceNote: _v, folders: _f, streetNotes: _n, review: _r, reviewNote: _rn, reviewedAt: _ra, ...rest } = hand;
  // What the player spends and where they play: no shared page shows them, so they stay here.
  const { buyIn: _b, venue: _vn, ...game } = hand.game;
  return {
    ...rest,
    game,
    // Cut to what the share page accepts: hands saved before the inputs had a limit still share.
    players: hand.players.map(({ playerId: _p, ...p }, i) => (i === hand.hero || opts.names ? { ...p, name: cut(p.name, MAX_NAME_LENGTH) } : { ...p, name: '' })),
    notes: opts.notes ? cut(hand.notes, MAX_NOTES_LENGTH) : '',
  } as Hand;
}
