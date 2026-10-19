import { isValidCard } from './format';
import type { HandRecord } from './types';
import { STREETS } from './types';

const ACTION_TYPES = new Set([
  'post_sb', 'post_bb', 'post_ante', 'post_straddle', 'fold', 'check', 'call', 'bet', 'raise', 'allin',
]);

/** Longest player name the share page accepts. */
export const MAX_NAME_LENGTH = 40;
/** Longest notes the share page accepts. */
export const MAX_NOTES_LENGTH = 2000;

const isAmount = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Returns a list of problems; empty means the record is safe to replay. */
export function validateHand(input: unknown): string[] {
  const errors: string[] = [];
  const h = input as HandRecord;
  if (!h || typeof h !== 'object') return ['not an object'];
  if (h.version !== 1) errors.push('version must be 1');
  if (h.game !== 'NLHE' && h.game !== 'PLO') errors.push('game');
  if (!h.blinds || !isAmount(h.blinds.bb) || h.blinds.bb <= 0 || !isAmount(h.blinds.sb)) errors.push('blinds');
  if (!Array.isArray(h.players) || h.players.length < 2 || h.players.length > 10) {
    errors.push('players: 2 to 10');
    return errors;
  }
  const seats = new Set<number>();
  const seen = new Set<string>();
  const holeCount = h.game === 'PLO' ? 4 : 2;
  for (const p of h.players) {
    if (!Number.isInteger(p.seat) || p.seat < 1 || p.seat > 10 || seats.has(p.seat)) errors.push(`seat ${p.seat}`);
    seats.add(p.seat);
    if (!isAmount(p.stack)) errors.push(`stack seat ${p.seat}`);
    if (p.name !== undefined && (typeof p.name !== 'string' || p.name.length > MAX_NAME_LENGTH)) errors.push(`name seat ${p.seat}`);
    if (p.cards) {
      if (!Array.isArray(p.cards) || p.cards.length !== holeCount || !p.cards.every(isValidCard)) errors.push(`cards seat ${p.seat}`);
      else for (const c of p.cards) seen.has(c) ? errors.push(`duplicate card ${c}`) : seen.add(c);
    }
  }
  if (!seats.has(h.buttonSeat)) errors.push('buttonSeat');
  const board = [...(h.board?.flop ?? []), ...(h.board?.turn ? [h.board.turn] : []), ...(h.board?.river ? [h.board.river] : [])];
  if (h.board?.flop && h.board.flop.length !== 3) errors.push('flop must have 3 cards');
  for (const c of board) {
    if (!isValidCard(c)) errors.push(`board card ${c}`);
    else if (seen.has(c)) errors.push(`duplicate card ${c}`);
    else seen.add(c);
  }
  if (h.board2 !== undefined) {
    if (!Array.isArray(h.board2) || h.board2.length > 5) errors.push('board2');
    else
      for (const c of h.board2) {
        if (!isValidCard(c)) errors.push(`board2 card ${c}`);
        else if (seen.has(c)) errors.push(`duplicate card ${c}`);
        else seen.add(c);
      }
  }
  if (!h.actions || typeof h.actions !== 'object') errors.push('actions');
  else
    for (const street of STREETS) {
      const list = h.actions[street];
      if (list === undefined) continue;
      if (!Array.isArray(list) || list.length > 60) {
        errors.push(`actions.${street}`);
        continue;
      }
      for (const a of list) {
        if (!seats.has(a.seat) || !ACTION_TYPES.has(a.type) || (a.amount !== undefined && !isAmount(a.amount)))
          errors.push(`action ${street} ${JSON.stringify(a)}`);
      }
    }
  if (h.tags && (!Array.isArray(h.tags) || h.tags.length > 20 || h.tags.some((t) => typeof t !== 'string' || t.length > 40)))
    errors.push('tags');
  if (h.winnerSeats !== undefined && (!Array.isArray(h.winnerSeats) || h.winnerSeats.some((s) => !seats.has(s)))) errors.push('winnerSeats');
  if (h.winnerSeats2 !== undefined && (!Array.isArray(h.winnerSeats2) || h.winnerSeats2.some((s) => !seats.has(s)))) errors.push('winnerSeats2');
  if (h.notes !== undefined && (typeof h.notes !== 'string' || h.notes.length > MAX_NOTES_LENGTH)) errors.push('notes');
  return errors;
}
