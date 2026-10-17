import { t } from '../i18n';

import { cardCode, score7 } from './equity';
import type { CardCode } from './types';

export const HAND_NAMES = [
  t('Carta alta'),
  t('Par'),
  t('Dois pares'),
  t('Trio'),
  t('Sequência'),
  t('Cor'),
  'Full house',
  t('Poker'),
  'Straight flush',
];

export interface Evaluation {
  score: number;
  category: number;
  name: string;
}

/**
 * Best five-card hand from 5–7 cards. One pass over the cards (score7): the
 * old way scored all 21 five-card subsets with arrays, sorts and maps, and the
 * hands list replays every hand on launch, so that was ~1 s on a slow Android
 * with 2,000 hands.
 */
export function evaluate(cards: CardCode[]): Evaluation {
  if (cards.length < 5) return { score: -1, category: -1, name: '' };
  const best = score7(cards.map(cardCode));
  const category = Math.floor(best / 15 ** 5);
  return { score: best, category, name: HAND_NAMES[category] ?? '' };
}
