import type { SeatView } from '@/components/Table';
import { C } from '@/theme';

import type { HandResult, LastAction, TableState } from './engine';
import { positions, totalPot } from './engine';
import { amount, decimal } from './format';
import type { Hand } from './types';
import { holeCount } from './variant';

export function actionLabel(a: LastAction, hand: Hand, inBB: boolean): string {
  const amt = amount(a.to, hand, inBB);
  if (a.allIn) return 'ALL-IN ' + amt;
  switch (a.kind) {
    case 'fold':
      return 'FOLD';
    case 'check':
      return 'CHECK';
    case 'call':
      return 'CALL ' + amount(a.added, hand, inBB);
    case 'bet':
      return 'BET ' + amt;
    case 'raise':
      return 'RAISE ' + amt;
  }
}

/** The size the felt adds to a bet or raise, as the replayer does: " (62%)" of the pot, " (3x)" the bet raised. */
export function actionSize(a: LastAction, s: TableState): string {
  if (a.kind === 'bet' && s.street !== 'preflop') {
    const before = totalPot(s) - a.added;
    return before > 0 ? ` (${Math.round((a.added / before) * 100)}%)` : '';
  }
  if (a.kind !== 'raise') return '';
  // Before a raise nobody had put in more than the bet it raises.
  const raised = Math.max(0, ...s.bets.filter((_, i) => i !== a.p));
  return raised > 0 && a.to > raised ? ` (${decimal(Math.round((a.to / raised) * 10) / 10).replace(/[.,]0$/, '')}x)` : '';
}

export function actionColor(a: LastAction): string {
  if (a.allIn) return C.allin;
  return { fold: C.fold, check: C.check, call: C.call, bet: C.bet, raise: C.raise }[a.kind];
}

export function narrate(a: LastAction | null, hand: Hand, inBB: boolean): string {
  if (!a) return '';
  const pos = positions(hand.players.length, hand.button);
  const who = displayName(hand, a.p, pos);
  return `${who}: ${actionLabel(a, hand, inBB).toLowerCase()}`;
}

export function displayName(hand: Hand, i: number, pos = positions(hand.players.length, hand.button)) {
  if (i === hand.hero) return hand.players[i].name || 'Hero';
  return hand.players[i].name || pos[i];
}

export function seatViews(
  hand: Hand,
  s: TableState,
  opts: { inBB: boolean; reveal?: boolean; result?: HandResult | null; hideActing?: boolean },
): SeatView[] {
  const pos = positions(hand.players.length, hand.button);
  return hand.players.map((p, i) => {
    const isHero = i === hand.hero;
    const known = p.cards && p.cards.length === holeCount(hand.game) ? p.cards : undefined;
    let cards: SeatView['cards'];
    if (isHero) cards = known ?? null;
    else if (s.folded[i]) cards = undefined;
    else if (opts.reveal && known) cards = known;
    else cards = null;
    const won = opts.result?.won[i] ?? 0;
    return {
      name: isHero ? p.name || 'Hero' : p.name || pos[i],
      pos: pos[i],
      stack: amount(s.stacks[i], hand, opts.inBB),
      cards,
      holes: holeCount(hand.game),
      folded: s.folded[i],
      acting: !opts.hideActing && s.toAct === i,
      hero: isHero,
      bet: s.bets[i] > 0 ? amount(s.bets[i], hand, opts.inBB) : undefined,
      action: s.last && s.last.p === i ? { label: actionLabel(s.last, hand, opts.inBB) + actionSize(s.last, s), color: actionColor(s.last) } : null,
      allIn: s.allIn[i] && !s.folded[i],
      winner: opts.result && won > 0 ? '+' + amount(won, hand, opts.inBB) : null,
      handName: opts.reveal ? opts.result?.handNames[i] ?? null : null,
    };
  });
}
