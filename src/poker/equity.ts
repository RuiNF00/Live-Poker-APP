// All-in equity for hold'em (and PLO) hands with known cards: each player's share of the pot
// if the rest of the board is dealt now. Exact when two cards or fewer are to come,
// a fixed-seed sample otherwise (preflop), so the same spot always shows the same number.

import { FULL_DECK, rankValue } from './cards';
import type { CardCode } from './types';

const SUIT_INDEX: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 };
/** Card as rank (2..14) * 4 + suit, so the inner loop never touches strings. */
export const cardCode = (c: CardCode) => rankValue(c) * 4 + SUIT_INDEX[c[1]];
const code = cardCode;

/** Highest straight in a rank bitmask (bit r = rank r, ace also as bit 1), or 0. */
function straightHigh(mask: number) {
  const m = mask & (1 << 14) ? mask | 2 : mask;
  for (let hi = 14; hi >= 5; hi--) if (((m >> (hi - 4)) & 31) === 31) return hi;
  return 0;
}

const pack = (cat: number, k: number[]) => {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 15 + (k[i] ?? 0);
  return s;
};

/**
 * Score of the best five of 5-7 cards (see cardCode); higher wins, equal ties.
 * Written for speed: equity calls it hundreds of thousands of times, and the
 * evaluator uses it for every showdown the app replays.
 */
export function score7(cards: number[]): number {
  const cnt = new Array<number>(15).fill(0);
  const suitMask = [0, 0, 0, 0];
  const suitCnt = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = c >> 2;
    const su = c & 3;
    cnt[r]++;
    mask |= 1 << r;
    suitMask[su] |= 1 << r;
    suitCnt[su]++;
  }
  const fs = suitCnt.findIndex((n) => n >= 5);
  if (fs >= 0) {
    const sf = straightHigh(suitMask[fs]);
    if (sf) return pack(8, [sf]);
  }
  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  const singles: number[] = [];
  for (let r = 14; r >= 2; r--) {
    if (cnt[r] === 4) quads.push(r);
    else if (cnt[r] === 3) trips.push(r);
    else if (cnt[r] === 2) pairs.push(r);
    else if (cnt[r] === 1) singles.push(r);
  }
  const high = (exclude: number[], n: number) => {
    const out: number[] = [];
    for (let r = 14; r >= 2 && out.length < n; r--) if (cnt[r] && !exclude.includes(r)) out.push(r);
    return out;
  };
  if (quads.length) return pack(7, [quads[0], ...high([quads[0]], 1)]);
  if (trips.length && (trips.length > 1 || pairs.length)) return pack(6, [trips[0], trips.length > 1 ? trips[1] : pairs[0]]);
  if (fs >= 0) {
    const k: number[] = [];
    for (let r = 14; r >= 2 && k.length < 5; r--) if (suitMask[fs] & (1 << r)) k.push(r);
    return pack(5, k);
  }
  const st = straightHigh(mask);
  if (st) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0], ...high([trips[0]], 2)]);
  if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1], ...high([pairs[0], pairs[1]], 1)]);
  if (pairs.length) return pack(1, [pairs[0], ...high([pairs[0]], 3)]);
  return pack(0, singles.slice(0, 5));
}

/** Deterministic PRNG (mulberry32) so a replay doesn't flicker between runs. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Score of exactly five cards, the same number score7 gives them, without allocating: Omaha
 * scores 60 five-card hands a player per board, and score7's arrays made a preflop PLO
 * spot take seconds on a phone.
 */
export function score5(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  let a = c0 >> 2, b = c1 >> 2, c = c2 >> 2, d = c3 >> 2, e = c4 >> 2, t: number;
  // Ranks high to low with a sorting network (no array to sort).
  if (a < b) { t = a; a = b; b = t; }
  if (d < e) { t = d; d = e; e = t; }
  if (c < e) { t = c; c = e; e = t; }
  if (c < d) { t = c; c = d; d = t; }
  if (b < e) { t = b; b = e; e = t; }
  if (a < d) { t = a; a = d; d = t; }
  if (a < c) { t = a; a = c; c = t; }
  if (b < d) { t = b; b = d; d = t; }
  if (b < c) { t = b; b = c; c = t; }
  const flush = ((c0 ^ c1) & 3) === 0 && ((c0 ^ c2) & 3) === 0 && ((c0 ^ c3) & 3) === 0 && ((c0 ^ c4) & 3) === 0;
  const distinct = a !== b && b !== c && c !== d && d !== e;
  // The wheel (A-5) is a five-high straight.
  const st = !distinct ? 0 : a - e === 4 ? a : a === 14 && b === 5 ? 5 : 0;
  if (flush && st) return pack5(8, st, 0, 0, 0, 0);
  if (!distinct) {
    if (a === d) return pack5(7, a, e, 0, 0, 0);
    if (b === e) return pack5(7, b, a, 0, 0, 0);
    if (a === c && d === e) return pack5(6, a, d, 0, 0, 0);
    if (a === b && c === e) return pack5(6, c, a, 0, 0, 0);
  }
  if (flush) return pack5(5, a, b, c, d, e);
  if (st) return pack5(4, st, 0, 0, 0, 0);
  if (distinct) return pack5(0, a, b, c, d, e);
  if (a === c) return pack5(3, a, d, e, 0, 0);
  if (b === d) return pack5(3, b, a, e, 0, 0);
  if (c === e) return pack5(3, c, a, b, 0, 0);
  if (a === b) return c === d ? pack5(2, a, c, e, 0, 0) : d === e ? pack5(2, a, d, c, 0, 0) : pack5(1, a, c, d, e, 0);
  if (b === c) return d === e ? pack5(2, b, d, a, 0, 0) : pack5(1, b, a, d, e, 0);
  if (c === d) return pack5(1, c, a, b, e, 0);
  return pack5(1, d, a, b, c, 0);
}

/** pack() for score5, without the array. */
const pack5 = (cat: number, k0: number, k1: number, k2: number, k3: number, k4: number) => ((((cat * 15 + k0) * 15 + k1) * 15 + k2) * 15 + k3) * 15 + k4;

/**
 * Omaha: the best hand with exactly two of the four hole cards and three of the five
 * board cards (60 ways), so four hearts on the board with one in hand is no flush.
 */
export function scoreOmaha(hole: number[], board: number[]): number {
  let best = -1;
  const n = board.length;
  for (let x = 0; x < n - 2; x++)
    for (let y = x + 1; y < n - 1; y++)
      for (let z = y + 1; z < n; z++)
        for (let a = 0; a < hole.length - 1; a++)
          for (let b = a + 1; b < hole.length; b++) {
            const s = score5(hole[a], hole[b], board[x], board[y], board[z]);
            if (s > best) best = s;
          }
  return best;
}

/** A hand's score on a full board: four hole cards play as Omaha, two as hold'em. */
export const scoreHand = (hole: number[], board: number[]) => (hole.length === 4 ? scoreOmaha(hole, board) : score7([...hole, ...board]));

function settle(holes: number[][], board: number[], into: number[]) {
  let best = -1;
  let winners: number[] = [];
  holes.forEach((h, i) => {
    const s = scoreHand(h, board);
    if (s > best) [best, winners] = [s, [i]];
    else if (s === best) winners.push(i);
  });
  for (const w of winners) into[w] += 1 / winners.length;
}

/**
 * Equity of each hand (0..1, summing to 1). `samples` only applies with three or more cards to come.
 * PLO samples fewer boards (each costs 60 five-card scores a hand, not one): 2000 keeps a preflop
 * spot well under a second on a phone, within about a point of the exact number.
 */
export function equity(holeCards: CardCode[][], boardCards: CardCode[], samples = holeCards.some((h) => h.length > 2) ? 2000 : 6000): number[] {
  const used = new Set([...holeCards.flat(), ...boardCards]);
  const deck = FULL_DECK.filter((c) => !used.has(c)).map(code);
  const holes = holeCards.map((h) => h.map(code));
  const board = boardCards.map(code);
  const need = 5 - board.length;
  const won = holes.map(() => 0);
  let runs = 0;
  if (need <= 0) {
    settle(holes, board, won);
    runs = 1;
  } else if (need === 1) {
    for (const c of deck) {
      settle(holes, [...board, c], won);
      runs++;
    }
  } else if (need === 2) {
    for (let i = 0; i < deck.length; i++)
      for (let j = i + 1; j < deck.length; j++) {
        settle(holes, [...board, deck[i], deck[j]], won);
        runs++;
      }
  } else {
    const rand = rng(holes.flat().reduce((a, c) => a * 31 + c, 7) + board.length);
    const d = deck.slice();
    for (; runs < samples; runs++) {
      // Partial Fisher-Yates: the first `need` cards are a uniform draw.
      for (let k = 0; k < need; k++) {
        const r = k + Math.floor(rand() * (d.length - k));
        [d[k], d[r]] = [d[r], d[k]];
      }
      settle(holes, [...board, ...d.slice(0, need)], won);
    }
  }
  return won.map((w) => w / runs);
}
