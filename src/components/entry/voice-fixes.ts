// The cards the player fixed by tapping on a hand told by voice. Pure, so it can be tested.
import type { CardCode, Hand } from '@/poker/types';

/** Where a card sits: hero's two, the board's five, or an opponent's two. */
export type Slot = { k: 'hero'; i: number } | { k: 'board'; i: number } | { k: 'seat'; seat: number; i: number };
export const slotKey = (s: Slot) => (s.k === 'seat' ? `s${s.seat}.${s.i}` : `${s.k[0]}${s.i}`);

/** A tapped card: what was heard there, and what the player picked instead. */
export interface CardFix {
  from: CardCode;
  to: CardCode;
}
export type CardFixes = Record<string, CardFix>;

export function cardAt(hand: Hand, s: Slot): CardCode | undefined {
  if (s.k === 'board') return hand.board[s.i];
  return hand.players[s.k === 'hero' ? hand.hero : s.seat].cards?.[s.i];
}

function setCard(hand: Hand, s: Slot, c: CardCode): Hand {
  if (s.k === 'board') return { ...hand, board: hand.board.map((x, i) => (i === s.i ? c : x)) };
  const p = s.k === 'hero' ? hand.hero : s.seat;
  return { ...hand, players: hand.players.map((x, i) => (i === p && x.cards ? { ...x, cards: x.cards.map((y, k) => (k === s.i ? c : y)) } : x)) };
}

/** Every card slot in the hand, so a picked card already in use swaps places with the one it replaces. */
export function slots(hand: Hand): Slot[] {
  const out: Slot[] = [];
  hand.players.forEach((p, seat) => p.cards?.forEach((_, i) => out.push(seat === hand.hero ? { k: 'hero', i } : { k: 'seat', seat, i })));
  hand.board.forEach((_, i) => out.push({ k: 'board', i }));
  return out;
}

/**
 * The fixes that still line up with what was heard: the slot still holds the card that was tapped.
 * Telling more of the hand («…river três») keeps the cards already fixed; saying a card again
 * differently there drops that one fix, since the new words are about it.
 */
export function liveFixes(heard: Hand, fixes: CardFixes): CardFixes {
  const out: CardFixes = {};
  const at = new Map(slots(heard).map((s) => [slotKey(s), s]));
  for (const [key, f] of Object.entries(fixes)) {
    const s = at.get(key);
    if (s && cardAt(heard, s) === f.from) out[key] = f;
  }
  return out;
}

/** The player's fixes on top of what was heard. A card used elsewhere trades places with the one it replaces. */
export function withFixes(heard: Hand, fixes: CardFixes): Hand {
  let h = heard;
  for (const [key, f] of Object.entries(liveFixes(heard, fixes))) {
    const s = slots(h).find((x) => slotKey(x) === key);
    if (!s) continue;
    const old = cardAt(h, s);
    if (!old || old === f.to) continue;
    const other = slots(h).find((x) => cardAt(h, x) === f.to);
    h = setCard(h, s, f.to);
    if (other) h = setCard(h, other, old);
  }
  return h;
}
