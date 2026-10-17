import { describe, expect, it } from 'vitest';
import { SAMPLE_TOURNAMENT_HAND, buildReplay, fromAppHand, isAppHand, validateHand, type AppHand } from '../src';

// The sample tournament hand written the way the mobile app stores it.
const APP_HAND: AppHand = {
  v: 1,
  game: { kind: 'mtt', name: 'Estoril Poker Series Main Event', stage: 'mid', level: 14, sb: 1000, bb: 2000, ante: 2000, anteType: 'bb', currency: 'EUR', playersLeft: 212, venue: 'Casino Estoril' },
  players: SAMPLE_TOURNAMENT_HAND.players.map((p) => ({ name: p.name ?? '', stack: p.stack, ...(p.cards ? { cards: p.cards } : {}) })),
  button: 5,
  hero: 5,
  actions: [
    { p: 8, kind: 'fold' }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' },
    { p: 3, kind: 'raise', to: 4500 }, { p: 4, kind: 'fold' }, { p: 5, kind: 'call' }, { p: 6, kind: 'fold' },
    { p: 7, kind: 'raise', to: 17000 }, { p: 3, kind: 'fold' }, { p: 5, kind: 'call' },
    { p: 7, kind: 'bet', to: 12000 }, { p: 5, kind: 'call' },
    { p: 7, kind: 'bet', to: 38000 }, { p: 5, kind: 'raise', to: 89000 }, { p: 7, kind: 'call' },
  ],
  board: ['Qd', '7h', '3h', '2c', 'Jh'],
  tags: ['3-bet pot'],
  notes: 'Devia ter feito 4-bet preflop?',
};

describe('fromAppHand', () => {
  it('detects the app format', () => {
    expect(isAppHand(APP_HAND)).toBe(true);
    expect(isAppHand(SAMPLE_TOURNAMENT_HAND)).toBe(false);
  });

  it('splits the flat action list into streets', () => {
    const { hand, actionMap } = fromAppHand(APP_HAND);
    expect(validateHand(hand)).toEqual([]);
    expect(hand.actions.preflop).toHaveLength(11);
    expect(hand.actions.flop).toHaveLength(2);
    expect(hand.actions.turn).toEqual([
      { seat: 8, type: 'bet', amount: 38000 },
      { seat: 6, type: 'allin', amount: 89000 },
      { seat: 8, type: 'call' },
    ]);
    expect(actionMap[14]).toEqual({ street: 'turn', index: 1 });
    expect(hand.tournament?.stage).toBe('middle');
    expect(hand.location).toBe('Casino Estoril');
  });

  it('replays to the same result as the native sample', () => {
    const a = buildReplay(fromAppHand(APP_HAND).hand).at(-1)!;
    const b = buildReplay(SAMPLE_TOURNAMENT_HAND).at(-1)!;
    expect(a.winners).toEqual(b.winners);
    expect(a.pot).toBe(b.pot);
  });

  it('uses manual winners when showdown cards are unknown', () => {
    const h: AppHand = {
      v: 1,
      game: { kind: 'cash', name: 'Casino Lisboa 2/5', sb: 2, bb: 5, ante: 0, anteType: 'none' },
      players: [{ name: 'A', stack: 500, cards: ['As', 'Ad'] }, { name: 'B', stack: 500 }, { name: 'C', stack: 500 }],
      button: 0,
      hero: 0,
      actions: [
        { p: 0, kind: 'raise', to: 15 }, { p: 1, kind: 'fold' }, { p: 2, kind: 'call' },
        { p: 2, kind: 'check' }, { p: 0, kind: 'bet', to: 20 }, { p: 2, kind: 'call' },
        { p: 2, kind: 'check' }, { p: 0, kind: 'check' },
        { p: 2, kind: 'check' }, { p: 0, kind: 'check' },
      ],
      board: ['Kc', '8d', '4s', '2h', '9c'],
      winners: [2],
    };
    const { hand } = fromAppHand(h);
    expect(hand.actions.river).toHaveLength(2);
    const end = buildReplay(hand).at(-1)!;
    expect(end.winners).toEqual([{ seat: 3, amount: 72, handLabel: undefined }]);
  });
});
