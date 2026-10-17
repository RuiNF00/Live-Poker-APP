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

export type HandResult = 'won' | 'lost';

export type HandFilter = {
  pos: string[];
  stack: StackBand | null;
  game: string | null;
  combos: string[];
  sort: HandSort;
  /** Hands hero won or lost, newest first (the sorts above order by size instead). */
  result?: HandResult | null;
  /** One session's hands ("Main Event Dia 1"). */
  session?: string | null;
};

export const NO_FILTER: HandFilter = { pos: [], stack: null, game: null, combos: [], sort: 'recent', result: null, session: null };

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

/** `netOf` gives hero's result; only needed when the filter has a result. */
export function matches(h: Hand, f: HandFilter, netOf?: (h: Hand) => number | undefined): boolean {
  if (f.session && h.sessionId !== f.session) return false;
  if (f.result) {
    const n = netOf?.(h);
    if (n === undefined || (f.result === 'won' ? n <= 0 : n >= 0)) return false;
  }
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

/**
 * What the hands search looks in: tournament or game, venue, notes, title, players, and hero's
 * cards both as a class ("aks") and as dealt ("ahkh").
 */
export function handSearchText(h: Hand): string {
  const cards = h.players[h.hero]?.cards;
  return [h.game.name, h.game.venue, h.notes, h.title, comboLabel(cards), cards?.join(''), ...h.players.map((p) => p.name)].join(' ').toLowerCase();
}

/** How many filters are on (sorting not counted). */
export function activeFilters(f: HandFilter): number {
  return (f.pos.length ? 1 : 0) + (f.stack ? 1 : 0) + (f.game ? 1 : 0) + (f.combos.length ? 1 : 0) + (f.result ? 1 : 0) + (f.session ? 1 : 0);
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

// ─── Search box: "AK lisboa", "QQ+ btn", "ATs+" ────────────────────────────────

const RANK_ORDER = 'AKQJT98765432';
const POSITIONS = new Set(['utg', 'utg+1', 'utg+2', 'mp', 'lj', 'hj', 'co', 'btn', 'sb', 'bb']);

/**
 * Hole cards as players write them: "AK" (suited and offsuit), "AKs", "AKo", "QQ", "QQ+" (QQ, KK, AA),
 * "ATs+" (ATs to AKs), "A5+". Null when the word isn't a hand.
 */
export function comboSet(word: string): Set<string> | null {
  const m = /^([2-9tjqka])([2-9tjqka])([so])?(\+)?$/i.exec(word.trim());
  if (!m) return null;
  let [a, b] = [m[1].toUpperCase(), m[2].toUpperCase()];
  if (RANK_ORDER.indexOf(a) > RANK_ORDER.indexOf(b)) [a, b] = [b, a];
  const suit = m[3]?.toLowerCase();
  const plus = !!m[4];
  const out = new Set<string>();
  if (a === b) {
    if (suit) return null;
    const from = RANK_ORDER.indexOf(a);
    for (let i = plus ? 0 : from; i <= from; i++) out.add(RANK_ORDER[i] + RANK_ORDER[i]);
    return out;
  }
  const hi = RANK_ORDER.indexOf(a);
  const lo = RANK_ORDER.indexOf(b);
  // "ATs+": the kicker climbs up to just under the top card.
  for (let i = plus ? hi + 1 : lo; i <= lo; i++)
    for (const x of suit ? [suit] : ['s', 'o']) out.add(a + RANK_ORDER[i] + x);
  return out;
}

export type SearchWord = { kind: 'combos'; set: Set<string> } | { kind: 'pos'; pos: string } | { kind: 'text'; text: string };

/** The search box split into words; a hand must match every one. */
export function parseSearch(q: string): SearchWord[] {
  return q
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((w): SearchWord => {
      const set = comboSet(w);
      if (set) return { kind: 'combos', set };
      if (POSITIONS.has(w)) return { kind: 'pos', pos: w };
      return { kind: 'text', text: w };
    });
}

/** `text` is handSearchText plus anything else the hand belongs to (its session's name and venue). */
export function matchesSearch(h: Hand, words: SearchWord[], text: string): boolean {
  for (const w of words) {
    if (w.kind === 'combos' && !w.set.has(comboLabel(h.players[h.hero]?.cards))) return false;
    if (w.kind === 'pos' && heroPosition(h).toLowerCase() !== w.pos) return false;
    if (w.kind === 'text' && !text.includes(w.text)) return false;
  }
  return true;
}
