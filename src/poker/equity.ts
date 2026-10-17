// All-in equity for hold'em hands with known cards: each player's share of the pot
// if the rest of the board is dealt now. Exact when two cards or fewer are to come,
// a fixed-seed sample otherwise (preflop), so the same spot always shows the same number.

import { FULL_DECK, rankValue } from './cards';
import type { CardCode } from './types';

const SUIT_INDEX: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 };
/** Card as rank (2..14) * 4 + suit, so the inner loop never touches strings. */
const code = (c: CardCode) => rankValue(c) * 4 + SUIT_INDEX[c[1]];

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
 * Score of the best five of 5-7 cards; higher wins, equal ties. Same ordering as
 * evaluator.ts, written for speed: equity calls it hundreds of thousands of times.
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

function settle(holes: number[][], board: number[], into: number[]) {
  let best = -1;
  let winners: number[] = [];
  holes.forEach((h, i) => {
    const s = score7([...h, ...board]);
    if (s > best) [best, winners] = [s, [i]];
    else if (s === best) winners.push(i);
  });
  for (const w of winners) into[w] += 1 / winners.length;
}

/** Equity of each hand (0..1, summing to 1). `samples` only applies with three or more cards to come. */
export function equity(holeCards: CardCode[][], boardCards: CardCode[], samples = 6000): number[] {
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
