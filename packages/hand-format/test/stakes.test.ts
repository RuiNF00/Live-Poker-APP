import { describe, expect, it } from 'vitest';
import { SAMPLE_TOURNAMENT_HAND, gameStakes, handTitle, stakesText, straddleOf, type HandRecord } from '../src';

// A 1/2 cash hand with a UTG straddle of 4 and a second straddle of 8.
const straddled: HandRecord = {
  ...SAMPLE_TOURNAMENT_HAND,
  format: 'cash',
  blinds: { sb: 1, bb: 2 },
  actions: {
    preflop: [
      { seat: 2, type: 'post_sb', amount: 1 },
      { seat: 3, type: 'post_bb', amount: 2 },
      { seat: 4, type: 'post_straddle', amount: 4 },
      { seat: 5, type: 'post_straddle', amount: 8 },
    ],
  },
};

describe('stakes with a straddle', () => {
  it('reads like the app: 1/2/8', () => {
    expect(straddleOf(straddled)).toBe(8);
    expect(stakesText(straddled.blinds, String, ' · ', straddleOf(straddled))).toBe('1/2/8');
    expect(handTitle(straddled)).toContain('1/2/8');
  });
  it('no straddle, no third number', () => {
    expect(straddleOf(SAMPLE_TOURNAMENT_HAND)).toBe(0);
    expect(stakesText({ sb: 1, bb: 2 }, String)).toBe('1/2');
  });
});

describe('PLO stakes', () => {
  it('say PLO wherever the stakes show, like the app; hold\'em unchanged', () => {
    const plo: HandRecord = { ...straddled, game: 'PLO', actions: { preflop: [] } };
    expect(gameStakes(plo, '1/2')).toBe('PLO 1/2');
    expect(gameStakes(straddled, '1/2')).toBe('1/2');
    expect(handTitle(plo)).toContain('PLO 1/2');
    expect(handTitle(straddled)).not.toContain('PLO');
  });
});
