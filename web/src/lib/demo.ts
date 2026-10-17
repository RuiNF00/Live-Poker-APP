import { SAMPLE_TOURNAMENT_HAND } from '@livepoker/hand-format';
import type { SharedHand } from './types';

/** Example hand served at /h/demo (the landing page links to it). */
export const DEMO_SHARE: SharedHand = {
  id: 'demo',
  payload: SAMPLE_TOURNAMENT_HAND,
  title: 'AQ suited vs 3-bet do big stack',
  revealAll: false,
  quiz: { street: 'turn', actionIndex: 1 },
  allowComments: true,
  viewCount: 0,
  createdAt: '2026-10-17T00:00:00.000Z',
};
