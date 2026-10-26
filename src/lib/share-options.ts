// What a shared hand carries, from the player's settings: the one place every share reads it from.

import type { ShareOptions } from '@/poker/privacy';
import type { Settings } from '@/store/types';

export function shareOptions(s: Pick<Settings, 'shareNames' | 'shareNotes' | 'shareHideMe' | 'shareHideGame'>): ShareOptions {
  return { names: s.shareNames, notes: s.shareNotes, me: !s.shareHideMe, game: !s.shareHideGame };
}
