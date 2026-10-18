import { buildReplay, fromAppHand, isAppHand, validateHand, type HandRecord, type ReplayStep, type Street } from '@livepoker/hand-format';
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

/** The app records challenge votes as comments like "🗳️ Fold", with the button's name: "Open", "3-Bet" and "C-bet" too. */
export const VOTE_COMMENT = /^🗳️?\s*(fold|check|call|c-?bet|[3-9]-?bet|bet|raise|open|all-?in)\b/i;

export function voteFromComment(text: string): VoteChoice | null {
  const m = VOTE_COMMENT.exec(text.trim());
  if (!m) return null;
  const c = m[1].toLowerCase().replace('-', '');
  // An open or a 3-bet is a raise, a c-bet a bet: the tally has one bar for each.
  if (c === 'open' || /^\dbet$/.test(c)) return 'raise';
  if (c === 'cbet') return 'bet';
  return c as VoteChoice;
}

const BOARD_AT: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };
const STREET_ORDER: Street[] = ['preflop', 'flop', 'turn', 'river'];

/**
 * What a challenge page may send before the friend votes: the hand up to the decision and
 * nothing that gives the answer away. Opponents' cards, later streets, the board still to
 * come, winners, tags and notes are dropped, and the decision itself becomes a stand-in fold
 * (it pays nothing, so the friend still sees the stack and pot they decide with).
 */
export function challengeTeaser(hand: HandRecord, spot: QuizSpot): HandRecord {
  const at = STREET_ORDER.indexOf(spot.street);
  const actions: HandRecord['actions'] = {};
  STREET_ORDER.forEach((street, i) => {
    const list = hand.actions[street] ?? [];
    if (i < at) actions[street] = list;
    else if (i === at) {
      const decision = list[spot.actionIndex];
      actions[street] = [...list.slice(0, spot.actionIndex), ...(decision ? [{ seat: decision.seat, type: 'fold' as const }] : [])];
    }
  });
  const shown = BOARD_AT[spot.street];
  const board: HandRecord['board'] = {};
  if (hand.board?.flop && shown >= 3) board.flop = hand.board.flop;
  if (hand.board?.turn && shown >= 4) board.turn = hand.board.turn;
  if (hand.board?.river && shown >= 5) board.river = hand.board.river;
  return {
    version: hand.version,
    game: hand.game,
    format: hand.format,
    currency: hand.currency,
    blinds: hand.blinds,
    tableSize: hand.tableSize,
    buttonSeat: hand.buttonSeat,
    players: hand.players.map((p) => ({ seat: p.seat, name: p.name, stack: p.stack, isHero: p.isHero, cards: p.isHero ? p.cards : null })),
    board,
    actions,
    tournament: hand.tournament,
    playedAt: hand.playedAt,
    location: hand.location,
  };
}

/** The street a comment's step belongs to; null for a comment on the whole hand. */
export function streetOfStep(steps: ReplayStep[], stepIndex: number | null): Street | null {
  return stepIndex !== null && steps[stepIndex] ? steps[stepIndex].street : null;
}

/** Where a comment "on the flop" points: the step that deals that street (the start, preflop). */
export function streetStep(steps: ReplayStep[], street: Street): number | null {
  const i = steps.findIndex((s) => s.street === street && (s.kind === 'start' || s.kind === 'street'));
  return i < 0 ? null : i;
}

/** Replay steps of a stored share, or null when the payload doesn't replay. */
export function stepsOf(payload: unknown): ReplayStep[] | null {
  const r = resolveHand(payload);
  return r ? buildReplay(r.hand) : null;
}
