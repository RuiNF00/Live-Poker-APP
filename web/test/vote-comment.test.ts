import { describe, expect, it } from 'vitest';

import { voteFromComment } from '@/lib/hand';

describe('challenge votes posted from the app', () => {
  it('counts every button name the app can post', () => {
    expect(voteFromComment('🗳️ Fold')).toBe('fold');
    expect(voteFromComment('🗳️ All-in')).toBe('allin');
    expect(voteFromComment('🗳️ Open')).toBe('raise');
    expect(voteFromComment('🗳️ 3-Bet')).toBe('raise');
    expect(voteFromComment('🗳️ 5-Bet')).toBe('raise');
    expect(voteFromComment('🗳️ C-bet')).toBe('bet');
    expect(voteFromComment('🗳️ Bet')).toBe('bet');
  });
  it('leaves real comments alone', () => {
    expect(voteFromComment('Open demais, fold era melhor')).toBeNull();
    expect(voteFromComment('Betting é arriscado')).toBeNull();
  });
});
