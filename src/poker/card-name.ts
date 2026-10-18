// What a screen reader says for a card: "Rei de espadas", not "K ♠".
// The rank and suit words live in cards.ts so every spoken card reads the same.
import { t } from '@/i18n';

import { cardName, rankName } from './cards';

export { cardName, rankName };

/** A starting hand class for a screen reader: "Ás e Rei, mesmo naipe", "Par, Sete". */
export function handClassName(cls: string): string {
  if (cls[0] === cls[1]) return t('Par, {rank}', { rank: rankName(cls[0]) });
  const v = { a: rankName(cls[0]), b: rankName(cls[1]) };
  return cls[2] === 's' ? t('{a} e {b}, mesmo naipe', v) : t('{a} e {b}, naipes diferentes', v);
}
