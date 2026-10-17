// The text that goes with a shared hand (link, challenge, video, post), the
// same on Instagram and X: the game's name, then the question. No hashtags,
// no amounts, nothing that reads as a contest. Copy in marketing/textos-partilha.md.

import { t } from '@/i18n';

export type HandShareKind = 'link' | 'challenge' | 'video';

export function handShareText(game: string | undefined, kind: HandShareKind): string {
  const g = game?.trim();
  if (kind === 'challenge') return g ? t('{game}: o que fazes aqui? Vota antes de ver o resultado 🗳️', { game: g }) : t('O que fazes aqui? Vota antes de ver o resultado 🗳️');
  if (kind === 'video') return g ? t('{game}: o que fazias aqui? A mão toda, rua a rua, no link 👀', { game: g }) : t('O que fazias aqui? A mão toda, rua a rua, no link 👀');
  return g ? t('{game}: o que fazias aqui? 👀', { game: g }) : t('O que fazias aqui? 👀');
}
