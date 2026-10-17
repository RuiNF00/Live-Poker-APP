import { fromAppHand, isAppHand, validateHand, type HandRecord, type Street } from '@livepoker/hand-format';
import type { QuizSpot, VoteChoice } from './types';

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

/**
 * Spot for the app's challenge links (`?q=1`): the hero's last action in the hand.
 * Returns null when the hero never acted.
 */
export function heroLastSpot(r: ResolvedHand, payload: unknown): QuizSpot | null {
  if (isAppHand(payload) && r.actionMap) {
    for (let i = Math.min(payload.actions.length, r.actionMap.length) - 1; i >= 0; i--) {
      if (payload.actions[i].p === payload.hero) return { street: r.actionMap[i].street, actionIndex: r.actionMap[i].index };
    }
    return null;
  }
  const hero = r.hand.players.find((p) => p.isHero)?.seat;
  for (const street of ['river', 'turn', 'flop', 'preflop'] as Street[]) {
    const list = r.hand.actions[street] ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].seat === hero && !list[i].type.startsWith('post_')) return { street, actionIndex: i };
    }
  }
  return null;
}

/** The app records challenge votes as comments like "🗳️ Fold". */
export const VOTE_COMMENT = /^🗳️?\s*(fold|check|call|bet|raise|all-?in)\b/i;

export function voteFromComment(text: string): VoteChoice | null {
  const m = VOTE_COMMENT.exec(text.trim());
  if (!m) return null;
  const c = m[1].toLowerCase().replace('-', '');
  return c as VoteChoice;
}
