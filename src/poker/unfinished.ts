// Hands saved half-way with "Guardar já": at the table there's no time, so they
// are finished later, on a break or at home. The editor reopens a hand where it
// stopped, so finding them is the only part to keep short.

import { isComplete } from './engine';
import type { Hand } from './types';

/** Unfinished hands, oldest first (the order they were played); one session's only, when given. */
export function unfinished(hands: Hand[], sessionId?: string, done: (h: Hand) => boolean = (h) => isComplete(h)): Hand[] {
  return hands.filter((h) => (sessionId === undefined || h.sessionId === sessionId) && !done(h)).sort((a, b) => a.createdAt - b.createdAt);
}
