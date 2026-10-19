// Hands out to GTO Wizard, PioSolver, Hold'em Manager or PokerTracker, as a
// PokerStars hand-history .txt they all import.

import { pokerStarsFile } from '@/poker/pokerstars';
import type { Hand } from '@/poker/types';

import { saveTextFile } from './files';
import { solverReady } from './solver-export-core';

export { solverReady };

export function solverFileName(hands: Hand[], now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  return hands.length === 1 ? `sweatbook-mao-${day}.txt` : `sweatbook-${hands.length}-maos-${day}.txt`;
}

export function saveSolverFile(hands: Hand[]): Promise<void> {
  return saveTextFile(solverFileName(hands), pokerStarsFile(hands), 'text/plain');
}
