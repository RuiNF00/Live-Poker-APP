// All-in equity for hold'em (and PLO) hands with known cards: each player's share of the pot
// if the rest of the board is dealt now. Exact when two cards or fewer are to come,
// a fixed-seed sample otherwise (preflop), so the same spot always shows the same number.

import { FULL_DECK, rankValue } from './cards';
import type { CardCode } from './types';

const SUIT_INDEX: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 };
/** Card as rank (2..14) * 4 + suit, so the inner loop never touches strings. */
export const cardCode = (c: CardCode) => rankValue(c) * 4 + SUIT_INDEX[c[1]];
const code = cardCode;

/** Highest set bit (a rank), or 0 for an empty mask. */
const top = (m: number) => (m ? 31 - Math.clz32(m) : 0);
const bits = (m: number) => {
  let c = 0;
  for (; m; c++) m &= m - 1;
  return c;
};
/** Highest straight in a rank mask (bit r = rank r; the ace also plays as 1), or 0. */
const straightTop = (m: number) => {
  const x = m & (1 << 14) ? m | 2 : m;
  return top(x & (x << 1) & (x << 2) & (x << 3) & (x << 4));
};
/** Packs like pack5: `s` holds the category and `n` ranks already, the top `k` ranks of `m` follow. */
function packTop(s: number, n: number, m: number, k: number) {
  for (let i = n; i < 5; i++) {
    const r = i - n < k ? top(m) : 0;
    m &= ~(1 << r);
    s = s * 15 + r;
  }
  return s;
}

/**
 * Score of the best five cards held across four suit masks (bit r = a card of rank r in that
 * suit), the same number score5 gives the best five. Bit operations only: equity runs it
 * hundreds of thousands of times a spot, and a preflop sample on a phone has to stay quick.
 */
export function scoreMasks(a: number, b: number, c: number, d: number): number {
  const fl = bits(a) >= 5 ? a : bits(b) >= 5 ? b : bits(c) >= 5 ? c : bits(d) >= 5 ? d : 0;
  if (fl) {
    const sf = straightTop(fl);
    if (sf) return pack5(8, sf, 0, 0, 0, 0);
  }
  const all = a | b | c | d;
  const quads = a & b & c & d;
  if (quads) {
    const q = top(quads);
    return pack5(7, q, top(all & ~(1 << q)), 0, 0, 0);
  }
  const trips = (a & b & c) | (a & b & d) | (a & c & d) | (b & c & d);
  const pairs = (a & b) | (a & c) | (a & d) | (b & c) | (b & d) | (c & d);
  const t = top(trips);
  // The best pair under the trips (a second set of trips plays as the pair).
  const under = pairs & ~(1 << t);
  if (trips && under) return pack5(6, t, top(under), 0, 0, 0);
  if (fl) return packTop(5, 0, fl, 5);
  const st = straightTop(all);
  if (st) return pack5(4, st, 0, 0, 0, 0);
  if (trips) return packTop(3 * 15 + t, 1, all & ~(1 << t), 2);
  const p = top(pairs);
  const q = top(pairs & ~(1 << p));
  if (q) return packTop((2 * 15 + p) * 15 + q, 2, all & ~(1 << p) & ~(1 << q), 1);
  if (p) return packTop(1 * 15 + p, 1, all & ~(1 << p), 3);
  return packTop(0, 0, all, 5);
}

/** A card's suit mask bit: cardCode is rank * 4 + suit. */
const addMask = (m: number[], c: number) => (m[c & 3] |= 1 << (c >> 2));

/**
 * Score of the best five of 5-7 cards (see cardCode); higher wins, equal ties.
 * The evaluator uses it for every showdown the app replays.
 */
export function score7(cards: number[]): number {
  const m = [0, 0, 0, 0];
  for (const c of cards) addMask(m, c);
  return scoreMasks(m[0], m[1], m[2], m[3]);
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

/** Suit masks of a hold'em hand plus a board: scores every board with bit operations. */
function holdemSettler(holes: number[][], won: number[]) {
  const masks = holes.map((h) => {
    const m = [0, 0, 0, 0];
    for (const c of h) addMask(m, c);
    return m;
  });
  const scores = holes.map(() => 0);
  return (b: number[]) => {
    let best = -1;
    let ties = 0;
    for (let i = 0; i < masks.length; i++) {
      const m = masks[i];
      const v = scoreMasks(m[0] | b[0], m[1] | b[1], m[2] | b[2], m[3] | b[3]);
      scores[i] = v;
      if (v > best) {
        best = v;
        ties = 1;
      } else if (v === best) ties++;
    }
    for (let i = 0; i < masks.length; i++) if (scores[i] === best) won[i] += 1 / ties;
  };
}

/**
 * Equity of each hand (0..1, summing to 1). `samples` only applies with three or more cards to come.
 * Hold'em samples 50 000 boards, each scored with bit operations (quicker than the 6 000 it took
 * before): within about 0.3 of a point of the exact number (AA against KK shows 82.6%,
 * like every equity calculator). PLO samples fewer (each board costs 60 five-card scores a hand):
 * 2000 keeps a preflop spot well under a second on a phone, within about a point.
 */
export function equity(holeCards: CardCode[][], boardCards: CardCode[], samples = holeCards.some((h) => h.length > 2) ? 2000 : 50000): number[] {
  const used = new Set([...holeCards.flat(), ...boardCards]);
  const deck = FULL_DECK.filter((c) => !used.has(c)).map(code);
  const holes = holeCards.map((h) => h.map(code));
  const board = boardCards.map(code);
  const need = 5 - board.length;
  const won = holes.map(() => 0);
  const omaha = holes.some((h) => h.length > 2);
  const settleMasks = holdemSettler(holes, won);
  const base = [0, 0, 0, 0];
  for (const c of board) addMask(base, c);
  const b = [0, 0, 0, 0];
  // One board: Omaha scores the cards, hold'em ORs the board's masks into each hand's.
  const run = (extra: number[]) => {
    if (omaha) return settle(holes, [...board, ...extra], won);
    for (let k = 0; k < 4; k++) b[k] = base[k];
    for (const c of extra) addMask(b, c);
    settleMasks(b);
  };
  let runs = 0;
  if (need <= 0) {
    run([]);
    runs = 1;
  } else if (need === 1) {
    for (const c of deck) {
      run([c]);
      runs++;
    }
  } else if (need === 2) {
    for (let i = 0; i < deck.length; i++)
      for (let j = i + 1; j < deck.length; j++) {
        run([deck[i], deck[j]]);
        runs++;
      }
  } else {
    const rand = rng(holes.flat().reduce((a, c) => a * 31 + c, 7) + board.length);
    const d = deck.slice();
    const drawn = new Array<number>(need).fill(0);
    for (; runs < samples; runs++) {
      // Partial Fisher-Yates: the first `need` cards are a uniform draw.
      for (let k = 0; k < need; k++) {
        const r = k + Math.floor(rand() * (d.length - k));
        const x = d[r];
        d[r] = d[k];
        d[k] = x;
        drawn[k] = x;
      }
      run(drawn);
    }
  }
  return won.map((w) => w / runs);
}
