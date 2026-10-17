import { fromAppHand, isAppHand, validateHand, type HandRecord, type Street } from '@livepoker/hand-format';
import type { QuizSpot } from './types';

export interface ResolvedHand {
  hand: HandRecord;
  /** Present for app hands: flat action index -> street position. */
  actionMap?: { street: Street; index: number }[];
}

/** Turns a stored payload (app `Hand` or HandRecord) into a replayable HandRecord, or null if invalid. */
export function resolveHand(payload: unknown): ResolvedHand | null {
  try {
    const resolved: ResolvedHand = isAppHand(payload) ? fromAppHand(payload) : { hand: payload as HandRecord };
    return validateHand(resolved.hand).length ? null : resolved;
  } catch {
    return null;
  }
}

/**
 * Quiz spot from the client: `{ action: n }` (index in the app's flat action list)
 * or `{ street, actionIndex }`. Must point at a real decision, not a blind post.
 */
export function parseQuiz(r: ResolvedHand, quiz: unknown): QuizSpot | null | 'invalid' {
  if (quiz == null) return null;
  const q = quiz as { action?: number; street?: Street; actionIndex?: number };
  const spot = Number.isInteger(q.action) ? r.actionMap?.[q.action!] : q.street && Number.isInteger(q.actionIndex) ? { street: q.street, index: q.actionIndex! } : undefined;
  if (!spot) return 'invalid';
  const action = r.hand.actions[spot.street]?.[spot.index];
  if (!action || action.type.startsWith('post_')) return 'invalid';
  return { street: spot.street, actionIndex: spot.index };
}
