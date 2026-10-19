// Simple preflop ranges ("top 20%") and equity against them. The 169 starting hands are
// ordered by all-in equity against a random hand (computed once with equity.ts, 20k runs
// each): a plain, explainable order, good enough for "what was I up against" in a review.

import { FULL_DECK, rankValue } from './cards';
import { score7 } from './equity';
import type { CardCode } from './types';

export const HAND_ORDER: string[] = ["AA","KK","QQ","JJ","TT","99","88","AKs","AQs","AJs","AKo","77","ATs","AQo","AJo","KJs","KQs","ATo","66","A9s","KTs","A8s","KQo","KJo","55","QJs","A7s","KTo","A9o","A5s","K9s","QTs","A8o","A6s","A4s","QJo","A7o","JTs","K8s","A3s","K9o","A5o","44","QTo","Q9s","K7s","A2s","A6o","A4o","K6s","J9s","JTo","K5s","K8o","Q8s","A3o","Q9o","K7o","K4s","A2o","J8s","Q7s","K2s","K6o","K3s","T9s","J9o","K5o","Q8o","33","K4o","Q6s","Q5s","J7s","J8o","Q7o","T8s","Q4s","K3o","K2o","T9o","98s","22","Q3s","Q2s","Q6o","T7s","J6s","Q5o","J5s","J7o","T8o","Q4o","J4s","97s","98o","J3s","Q3o","87s","T6s","J2s","Q2o","T7o","J5o","J6o","T5s","96s","J4o","86s","T4s","95s","97o","J3o","T3s","T6o","85s","J2o","T2s","87o","76s","T5o","94s","96o","75s","65s","86o","93s","T4o","92s","84s","95o","T3o","76o","T2o","85o","82s","83s","74s","54s","64s","94o","75o","73s","65o","93o","53s","84o","92o","63s","43s","72s","52s","82o","62s","54o","74o","83o","64o","42s","73o","53o","32s","63o","43o","72o","52o","62o","42o","32o"];

const SUITS = ['s', 'h', 'd', 'c'] as const;

/** Every combo of a hand class, e.g. "AKs" -> 4 combos, "QQ" -> 6, "T9o" -> 12. */
export function combosOf(cls: string): CardCode[][] {
  const [a, b] = [cls[0], cls[1]];
  const out: CardCode[][] = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      if (a === b ? j <= i : cls[2] === 's' ? i !== j : i === j) continue;
      out.push([a + SUITS[i], b + SUITS[j]]);
    }
  return out;
}

const TOTAL = 1326;

/** The strongest hands making up about `pct` percent of all 1326 combos. */
export function topRange(pct: number): CardCode[][] {
  return rangeOf(topClasses(pct));
}

/** The hand classes of `topRange(pct)`, strongest first. */
export function topClasses(pct: number): string[] {
  const want = (Math.max(0, Math.min(100, pct)) / 100) * TOTAL;
  const out: string[] = [];
  let n = 0;
  for (const cls of HAND_ORDER) {
    if (n >= want) break;
    out.push(cls);
    n += combosOf(cls).length;
  }
  return out;
}

/** Every combo of the given hand classes. */
export function rangeOf(classes: Iterable<string>): CardCode[][] {
  const out: CardCode[][] = [];
  for (const cls of classes) out.push(...combosOf(cls));
  return out;
}

/** Share of all 1326 combos the classes cover, in percent (one decimal). */
export function rangePct(classes: Iterable<string>): number {
  let n = 0;
  for (const cls of classes) n += combosOf(cls).length;
  return Math.round((n / TOTAL) * 1000) / 10;
}

export const GRID_RANKS = 'AKQJT98765432';

/** The class in row `i`, column `j` of the 13×13 grid: pairs on the diagonal, suited above it, offsuit below. */
export function gridClass(i: number, j: number): string {
  const [a, b] = [GRID_RANKS[i], GRID_RANKS[j]];
  return i === j ? a + b : i < j ? a + b + 's' : b + a + 'o';
}

const SI: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 };
const code = (c: CardCode) => rankValue(c) * 4 + SI[c[1]];

/**
 * Hero's equity (0..1) against one hand drawn from `range`, with the board run out.
 * Combos that clash with hero's cards or the board are left out. Exact on the turn and
 * river; earlier, a fixed-seed sample, so the same spot always shows the same number.
 * Returns null when no combo is possible.
 */
export function equityVsRange(hero: CardCode[], range: CardCode[][], board: CardCode[], samples = 4000): number | null {
  const dead = new Set([...hero, ...board]);
  const combos = range.filter((c) => !dead.has(c[0]) && !dead.has(c[1])).map((c) => c.map(code));
  if (!combos.length) return null;
  const h = hero.map(code);
  const b = board.map(code);
  const deck = FULL_DECK.filter((c) => !dead.has(c)).map(code);
  const need = 5 - b.length;
  const share = (v: number[], run: number[]) => {
    const x = score7([...h, ...run]);
    const y = score7([...v, ...run]);
    return x > y ? 1 : x === y ? 0.5 : 0;
  };

  if (need <= 1) {
    let won = 0;
    let n = 0;
    for (const v of combos) {
      if (need === 0) {
        won += share(v, b);
        n++;
        continue;
      }
      for (const c of deck) {
        if (c === v[0] || c === v[1]) continue;
        won += share(v, [...b, c]);
        n++;
      }
    }
    return won / n;
  }

  let s = (combos.length * 7919 + h[0] * 31 + h[1] + b.length) >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const d = deck.slice();
  let won = 0;
  for (let n = 0; n < samples; n++) {
    const v = combos[Math.floor(rand() * combos.length)];
    // Partial shuffle over the deck, skipping villain's two cards.
    const run = [...b];
    let k = 0;
    while (run.length < 5) {
      const r = k + Math.floor(rand() * (d.length - k));
      [d[k], d[r]] = [d[r], d[k]];
      if (d[k] !== v[0] && d[k] !== v[1]) run.push(d[k]);
      k++;
    }
    won += share(v, run);
  }
  return won / samples;
}

/** Range villain likely holds, from their strongest preflop raise: 1 = open, 2 = 3-bet, 3+ = 4-bet, 0 = only called. */
export function rangePctForRaises(level: number): number {
  return level <= 0 ? 40 : level === 1 ? 20 : level === 2 ? 8 : 4;
}
