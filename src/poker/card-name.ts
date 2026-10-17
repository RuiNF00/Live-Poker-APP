// What a screen reader says for a card: "Rei de espadas", not "K ♠".
import { t } from '@/i18n';

import type { CardCode } from './types';

const RANK: Record<string, string> = {
  A: 'Ás',
  K: 'Rei',
  Q: 'Dama',
  J: 'Valete',
  T: 'Dez',
  '9': 'Nove',
  '8': 'Oito',
  '7': 'Sete',
  '6': 'Seis',
  '5': 'Cinco',
  '4': 'Quatro',
  '3': 'Três',
  '2': 'Dois',
};
const SUIT: Record<string, string> = { s: 'espadas', h: 'copas', d: 'ouros', c: 'paus' };

export function cardName(c: CardCode): string {
  const r = RANK[c[0]];
  const s = SUIT[c[1]];
  if (!r || !s) return c;
  return t('{rank} de {suit}', { rank: t(r), suit: t(s) });
}

/** A rank's word: "Ás", "Rei", "Dez". */
export function rankName(r: string): string {
  return RANK[r] ? t(RANK[r]) : r;
}

/** A starting hand class for a screen reader: "Ás e Rei, mesmo naipe", "Par, Sete". */
export function handClassName(cls: string): string {
  if (cls[0] === cls[1]) return t('Par, {rank}', { rank: rankName(cls[0]) });
  const v = { a: rankName(cls[0]), b: rankName(cls[1]) };
  return cls[2] === 's' ? t('{a} e {b}, mesmo naipe', v) : t('{a} e {b}, naipes diferentes', v);
}
