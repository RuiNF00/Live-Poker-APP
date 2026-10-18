import { isPlayedOut } from '@/poker/engine';
import type { Hand } from '@/poker/types';

/** Hands a solver can read: only finished ones. */
export function solverReady(hands: Hand[]): Hand[] {
  return hands.filter((h) => isPlayedOut(h));
}
