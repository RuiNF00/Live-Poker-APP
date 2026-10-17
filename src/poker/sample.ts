import { t } from '../i18n';

import type { Hand } from './types';

/** A complete example hand, for the empty state and store screenshots. */
export function sampleHand(id: string): Hand {
  const now = Date.now();
  return {
    v: 1,
    id,
    createdAt: now,
    updatedAt: now,
    game: { kind: 'mtt', name: t('Torneio de domingo') + ' €550', sb: 1000, bb: 2000, ante: 2000, anteType: 'bb', currency: '€', stage: 'bubble', level: 14, playersLeft: 58 },
    players: [
      { name: 'Hero', stack: 64000, cards: ['Ah', 'Qh'] },
      { name: '', stack: 51000 },
      { name: t('Boné azul'), stack: 120000, cards: ['Kc', 'Kd'] },
      { name: '', stack: 38000 },
      { name: '', stack: 72000 },
      { name: '', stack: 45000 },
      { name: t('Reg alemão'), stack: 88000 },
      { name: '', stack: 30000 },
      { name: '', stack: 96000 },
    ],
    button: 0,
    hero: 0,
    actions: [
      { p: 3, kind: 'fold' },
      { p: 4, kind: 'fold' },
      { p: 5, kind: 'fold' },
      { p: 6, kind: 'raise', to: 4400 },
      { p: 7, kind: 'fold' },
      { p: 8, kind: 'fold' },
      { p: 0, kind: 'raise', to: 12000 },
      { p: 1, kind: 'fold' },
      { p: 2, kind: 'raise', to: 30000 },
      { p: 6, kind: 'fold' },
      { p: 0, kind: 'raise', to: 64000 },
      { p: 2, kind: 'call' },
    ],
    board: ['Qd', '8h', '3h', '2s', 'Jh'],
    tags: ['Bolha', 'Pote grande', 'Dúvida'],
    notes: t('Bolha a 58 com 54 pagos. O boné azul só tinha 3-betado uma vez em 3 horas. Fold era melhor?'),
  };
}
