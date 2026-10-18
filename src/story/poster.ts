// The one line under the cards on the hand poster (components/HandPoster.tsx).

import { t } from '@/i18n';
import type { Hand } from '@/poker/types';

import type { StoryMoment } from './moment';

/** The player's comment; else the question, or hero's hand and whether hero took the pot. Never an amount. */
export function posterLine(hand: Hand, moment: StoryMoment, comment: string): string {
  const text = comment.trim();
  if (text) return text;
  if (moment.mode === 'question') return t('O que fazes aqui?');
  const r = moment.replay.result;
  const heroWon = !!r?.resolved && r.net[hand.hero] > 0;
  const outcome = [r?.handNames[hand.hero] ?? null, heroWon ? t('Hero leva o pote') : null].filter(Boolean).join(' · ');
  return outcome || t('Mão jogada');
}
