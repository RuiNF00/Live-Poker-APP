import type { Street } from '@livepoker/hand-format';

export interface QuizSpot {
  street: Street;
  /** Index into hand.actions[street] of the hero action friends must guess. */
  actionIndex: number;
}

export interface SharedHand {
  id: string;
  /** Hand as uploaded: the app's `Hand` (v: 1) or a HandRecord (version: 1). */
  payload: unknown;
  title: string | null;
  revealAll: boolean;
  quiz: QuizSpot | null;
  allowComments: boolean;
  viewCount: number;
  createdAt: string;
}

/** Same shape the app's share-api expects (name, text, createdAt in ms). */
export interface HandComment {
  id: string;
  name: string;
  text: string;
  stepIndex: number | null;
  createdAt: number;
}

export type VoteChoice = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
export const VOTE_CHOICES: VoteChoice[] = ['fold', 'check', 'call', 'bet', 'raise', 'allin'];
