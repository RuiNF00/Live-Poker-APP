import type { Hand } from '../poker/types';

/**
 * After saving, a new hand of a live session goes straight to the next hand (with a toast to see the
 * one just saved): at the table the next hand is what comes next. An edit, a hand saved again, or a
 * hand entered outside a live session opens the hand's page, as before (Design, menos-toques-2a).
 */
export function nextHandAfterSave(o: { asNew: boolean; isEdit: boolean; hand: Pick<Hand, 'sessionId'>; liveSessionId?: string | null }): boolean {
  return o.asNew && !o.isEdit && !!o.hand.sessionId && o.hand.sessionId === o.liveSessionId;
}
