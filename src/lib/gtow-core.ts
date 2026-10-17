// GTO Wizard has no upload link or API: the hand goes over the clipboard. We copy it in
// PokerStars format (the same text the solver export saves) and open the Analyze uploads
// page, where the player pastes it. Pure part, testable without React Native.

import { pokerStarsFile } from '@/poker/pokerstars';
import type { Hand } from '@/poker/types';

import { solverReady } from './solver-export-core';

export const GTOW_UPLOADS_URL = 'https://app.gtowizard.com/analyze/uploads';

/** What goes to the clipboard: the finished hands, oldest first; unfinished ones are counted out. */
export function gtowPayload(hands: Hand[]): { text: string; sent: number; skipped: number } {
  const ready = solverReady(hands);
  return { text: ready.length ? pokerStarsFile(ready) : '', sent: ready.length, skipped: hands.length - ready.length };
}
