import { rankValue, suitOf } from './cards';
import type { CardCode } from './types';

export const HAND_NAMES = [
  'Carta alta',
  'Par',
  'Dois pares',
  'Trio',
  'Sequência',
  'Cor',
  'Full house',
  'Poker',
  'Straight flush',
];

/** Score of exactly five cards. Higher wins; equal ties. */
function score5(cards: CardCode[]): number {
  const vals = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const uniq = [...new Set(vals)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0];
    else if (vals[0] === 14 && vals[1] === 5) straightHigh = 5; // wheel
  }
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Order ranks by (count desc, rank desc) for kickers.
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ordered = groups.map((g) => g[0]);
  const shape = groups.map((g) => g[1]).join('');

  let cat: number;
  let kick: number[];
  if (straightHigh && flush) [cat, kick] = [8, [straightHigh]];
  else if (shape === '41') [cat, kick] = [7, ordered];
  else if (shape === '32') [cat, kick] = [6, ordered];
  else if (flush) [cat, kick] = [5, vals];
  else if (straightHigh) [cat, kick] = [4, [straightHigh]];
  else if (shape === '311') [cat, kick] = [3, ordered];
  else if (shape === '221') [cat, kick] = [2, ordered];
  else if (shape === '2111') [cat, kick] = [1, ordered];
  else [cat, kick] = [0, vals];

  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 15 + (kick[i] ?? 0);
  return s;
}

export interface Evaluation {
  score: number;
  category: number;
  name: string;
}

/** Best five-card hand from 5–7 cards. */
export function evaluate(cards: CardCode[]): Evaluation {
  let best = -1;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (s > best) best = s;
          }
  const category = Math.floor(best / 15 ** 5);
  return { score: best, category, name: HAND_NAMES[category] ?? '' };
}
