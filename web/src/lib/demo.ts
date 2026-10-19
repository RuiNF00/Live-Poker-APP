import { SAMPLE_TOURNAMENT_HAND } from '@livepoker/hand-format';
import type { SharedHand } from './types';

/** Example hand served at /h/demo (the landing page links to it). */
export const DEMO_SHARE: SharedHand = {
  id: 'demo',
  // The landing page links here: no real series or venue, and no «bet» tag on the page or its preview.
  payload: {
    ...SAMPLE_TOURNAMENT_HAND,
    tournament: SAMPLE_TOURNAMENT_HAND.tournament && { ...SAMPLE_TOURNAMENT_HAND.tournament, name: 'Main Event' },
    location: 'Lisboa',
    tags: ['Cooler?'],
  },
  title: 'AQs vs big stack',
  revealAll: false,
  quiz: { street: 'turn', actionIndex: 1 },
  allowComments: true,
  viewCount: 0,
  createdAt: '2026-10-17T00:00:00.000Z',
};
