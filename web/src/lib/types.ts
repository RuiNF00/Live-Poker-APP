import type { HandRecord, Street } from '@livepoker/hand-format';

export interface QuizSpot {
  street: Street;
  /** Index into hand.actions[street] of the hero action friends must guess. */
  actionIndex: number;
}

export interface SharedHand {
  id: string;
  hand: HandRecord;
  title: string | null;
  revealAll: boolean;
  quiz: QuizSpot | null;
  allowComments: boolean;
  viewCount: number;
  createdAt: string;
}

export interface HandComment {
  id: string;
  authorName: string;
  body: string;
  stepIndex: number | null;
  createdAt: string;
}

export type VoteChoice = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
export const VOTE_CHOICES: VoteChoice[] = ['fold', 'check', 'call', 'bet', 'raise', 'allin'];
