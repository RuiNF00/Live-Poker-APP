import type { Card, Locale } from './types';

export type HandCategory =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'trips'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'quads'
  | 'straight_flush';

const CATEGORIES: HandCategory[] = [
  'high_card',
  'pair',
  'two_pair',
  'trips',
  'straight',
  'flush',
  'full_house',
  'quads',
  'straight_flush',
];

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14,
};

export interface HandValue {
  score: number;
  category: HandCategory;
  cards: Card[];
}

export function rankValue(card: Card): number {
  return RANK_VALUE[card[0]];
}

function encode(category: number, kickers: number[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 15 + (kickers[i] ?? 0);
  return score;
}

export function evaluate5(cards: Card[]): HandValue {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const unique = [...new Set(values)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (values[0] - values[4] === 4) straightHigh = values[0];
    else if (values[0] === 14 && values[1] === 5) straightHigh = 5; // wheel
  }

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Groups ordered by size then rank, e.g. full house [[K,3],[7,2]]
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = groups.map((g) => g[0]);

  let cat: number;
  let kick: number[];
  if (straightHigh && flush) [cat, kick] = [8, [straightHigh]];
  else if (groups[0][1] === 4) [cat, kick] = [7, byGroup];
  else if (groups[0][1] === 3 && groups[1][1] === 2) [cat, kick] = [6, byGroup];
  else if (flush) [cat, kick] = [5, values];
  else if (straightHigh) [cat, kick] = [4, [straightHigh]];
  else if (groups[0][1] === 3) [cat, kick] = [3, byGroup];
  else if (groups[0][1] === 2 && groups[1][1] === 2) [cat, kick] = [2, byGroup];
  else if (groups[0][1] === 2) [cat, kick] = [1, byGroup];
  else [cat, kick] = [0, values];

  return { score: encode(cat, kick), category: CATEGORIES[cat], cards };
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - acc.length); i++) {
      acc.push(items[i]);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out;
}

/** Best hand. NLHE: any 5 of hole + board. PLO: exactly 2 hole + 3 board. */
export function bestHand(hole: Card[], board: Card[], game: 'NLHE' | 'PLO' = 'NLHE'): HandValue | null {
  if (board.length < 3 || hole.length < 2) return null;
  let best: HandValue | null = null;
  const consider = (five: Card[]) => {
    const v = evaluate5(five);
    if (!best || v.score > best.score) best = v;
  };
  if (game === 'PLO') {
    for (const h of combinations(hole, 2)) for (const b of combinations(board, 3)) consider([...h, ...b]);
  } else {
    for (const five of combinations([...hole, ...board], 5)) consider(five);
  }
  return best;
}

const CATEGORY_LABEL: Record<Locale, Record<HandCategory, string>> = {
  pt: {
    high_card: 'Carta alta',
    pair: 'Par',
    two_pair: 'Dois pares',
    trips: 'Trio',
    straight: 'Sequência',
    flush: 'Cor',
    full_house: 'Full house',
    quads: 'Poker',
    straight_flush: 'Sequência de cor',
  },
  en: {
    high_card: 'High card',
    pair: 'Pair',
    two_pair: 'Two pair',
    trips: 'Three of a kind',
    straight: 'Straight',
    flush: 'Flush',
    full_house: 'Full house',
    quads: 'Four of a kind',
    straight_flush: 'Straight flush',
  },
  'pt-BR': {
    high_card: 'Carta alta',
    pair: 'Par',
    two_pair: 'Dois pares',
    trips: 'Trinca',
    straight: 'Sequência',
    flush: 'Flush',
    full_house: 'Full house',
    quads: 'Quadra',
    straight_flush: 'Straight flush',
  },
  es: {
    high_card: 'Carta alta',
    pair: 'Pareja',
    two_pair: 'Doble pareja',
    trips: 'Trío',
    straight: 'Escalera',
    flush: 'Color',
    full_house: 'Full',
    quads: 'Póker',
    straight_flush: 'Escalera de color',
  },
};

export function categoryLabel(category: HandCategory, locale: Locale = 'pt'): string {
  return (CATEGORY_LABEL[locale] ?? CATEGORY_LABEL.en)[category];
}
