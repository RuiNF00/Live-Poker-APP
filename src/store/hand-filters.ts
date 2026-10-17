// Hands list filters: hero's position, stack depth in bb, the game, hole-card
// combos from the 13×13 grid, and sorting by bb won or lost. Pure, so the
// list and the tests agree.

import { comboLabel, RANKS } from '../poker/cards';
import { positions } from '../poker/engine';
import type { Hand } from '../poker/types';

export type StackBand = 'short' | 'mid' | 'deep' | 'vdeep';
export type HandSort = 'recent' | 'won' | 'lost';

export const STACK_BANDS: { key: StackBand; label: string; min: number; max: number }[] = [
  { key: 'short', label: '< 20 bb', min: 0, max: 20 },
  { key: 'mid', label: '20–40 bb', min: 20, max: 40 },
  { key: 'deep', label: '40–100 bb', min: 40, max: 100 },
  { key: 'vdeep', label: '100+ bb', min: 100, max: Infinity },
];

export type HandFilter = { pos: string[]; stack: StackBand | null; game: string | null; combos: string[]; sort: HandSort };

export const NO_FILTER: HandFilter = { pos: [], stack: null, game: null, combos: [], sort: 'recent' };

export function heroPosition(h: Hand): string {
  return positions(h.players.length, h.button)[h.hero] ?? '';
}

/** Hero's starting stack in big blinds; null without blinds. */
export function heroStackBB(h: Hand): number | null {
  return h.game.bb > 0 ? h.players[h.hero].stack / h.game.bb : null;
}

export function gameKey(h: Hand): string {
  return h.game.name.trim();
}

export function matches(h: Hand, f: HandFilter): boolean {
  if (f.pos.length && !f.pos.includes(heroPosition(h))) return false;
  if (f.stack) {
    const bb = heroStackBB(h);
    const band = STACK_BANDS.find((b) => b.key === f.stack)!;
    if (bb === null || bb < band.min || bb >= band.max) return false;
  }
  if (f.game && gameKey(h) !== f.game) return false;
  if (f.combos.length && !f.combos.includes(comboLabel(h.players[h.hero].cards))) return false;
  return true;
}

/** How many filters are on (sorting not counted). */
export function activeFilters(f: HandFilter): number {
  return (f.pos.length ? 1 : 0) + (f.stack ? 1 : 0) + (f.game ? 1 : 0) + (f.combos.length ? 1 : 0);
}

/** Biggest wins or losses first, in bb; hands without a result go last. */
export function sortByResult(hands: Hand[], sort: Exclude<HandSort, 'recent'>, netOf: (h: Hand) => number | undefined): Hand[] {
  const bb = (h: Hand) => {
    const n = netOf(h);
    return n === undefined || !h.game.bb ? null : n / h.game.bb;
  };
  const dir = sort === 'won' ? -1 : 1;
  return hands
    .map((h) => ({ h, v: bb(h) }))
    .sort((a, b) => (a.v === null ? (b.v === null ? b.h.createdAt - a.h.createdAt : 1) : b.v === null ? -1 : dir * (a.v - b.v) || b.h.createdAt - a.h.createdAt))
    .map((x) => x.h);
}

/** The 13×13 grid: pairs on the diagonal, suited above it, offsuit below. */
export function gridCombo(row: number, col: number): string {
  const a = RANKS[Math.min(row, col)];
  const b = RANKS[Math.max(row, col)];
  return row === col ? a + a : a + b + (row < col ? 's' : 'o');
}
