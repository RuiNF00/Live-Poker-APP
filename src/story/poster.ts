// The one line under the cards on the hand poster (components/HandPoster.tsx).

import { t } from '@/i18n';
import type { Hand } from '@/poker/types';

import type { StoryMoment } from './moment';

/** The player's comment; else the question, or hero's hand at showdown ("Flush"). Never an amount: the bb numbers say how it went. */
export function posterLine(hand: Hand, moment: StoryMoment, comment: string): string {
  const text = comment.trim();
  if (text) return text;
  if (moment.mode === 'question') return t('O que fazes aqui?');
  return moment.replay.result?.handNames[hand.hero] ?? '';
}
