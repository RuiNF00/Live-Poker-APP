import { describe, expect, it } from 'vitest';
import { buildReplay, fromAppHand, livePosts, validateHand, type AppHand } from '../src';

// A 6-handed 2/5 cash game; button on player 0, so SB = 1, BB = 2, UTG = 3, HJ = 4, CO = 5.
const base = (game: Partial<AppHand['game']>, actions: AppHand['actions'], board: string[] = []): AppHand => ({
  v: 1,
  game: { kind: 'cash', name: 'Casino Lisboa 2/5', sb: 2, bb: 5, ante: 0, anteType: 'none', ...game },
  players: [
    { name: 'BTN', stack: 1000, cards: ['As', 'Ad'] },
    { name: 'SB', stack: 1000 },
    { name: 'BB', stack: 1000 },
    { name: 'UTG', stack: 1000 },
    { name: 'HJ', stack: 1000 },
    { name: 'CO', stack: 1000, cards: ['Kc', 'Kd'] },
  ],
  button: 0,
  hero: 0,
  actions,
  board,
});

const end = (h: AppHand) => buildReplay(fromAppHand(h).hand).at(-1)!;
const total = (h: AppHand) => buildReplay(fromAppHand(h).hand).reduce((m, s) => Math.max(m, s.totalPot), 0);

describe('live cases', () => {
  it('plain hands keep the implied blinds', () => {
    expect(livePosts(base({}, []))).toBeNull();
    const { hand } = fromAppHand(base({ ante: 5, anteType: 'bb' }, [{ p: 3, kind: 'fold' }]));
    expect(hand.blinds.bbAnte).toBe(true);
    expect(hand.actions.preflop?.some((a) => a.type.startsWith('post_'))).toBe(false);
  });

  it('UTG straddle posts 2bb and acts last preflop', () => {
    // Folds to CO who calls 10, button calls, blinds fold, the straddler checks: flop.
    const h = base({ straddles: 1, straddleFrom: 'utg' }, [
      { p: 4, kind: 'fold' }, { p: 5, kind: 'call' }, { p: 0, kind: 'call' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }, { p: 3, kind: 'check' },
      { p: 3, kind: 'check' }, { p: 5, kind: 'check' }, { p: 0, kind: 'bet', to: 20 }, { p: 3, kind: 'fold' }, { p: 5, kind: 'fold' },
    ], ['2c', '7d', '9h']);
    const { hand } = fromAppHand(h);
    expect(validateHand(hand)).toEqual([]);
    expect(hand.actions.preflop?.slice(0, 3)).toEqual([
      { seat: 2, type: 'post_sb', amount: 2 },
      { seat: 3, type: 'post_bb', amount: 5 },
      { seat: 4, type: 'post_straddle', amount: 10 },
    ]);
    // The straddler's check closes preflop; the flop starts with the straddler.
    expect(hand.actions.preflop?.at(-1)).toEqual({ seat: 4, type: 'check' });
    expect(hand.actions.flop?.[0]).toEqual({ seat: 4, type: 'check' });
    // The uncalled flop bet goes back to the button; the pot it wins is the preflop 37.
    expect(end(h).winners).toEqual([{ seat: 1, amount: 2 + 5 + 30 }]);
    expect(end(h).seats.find((s) => s.seat === 1)!.stack).toBe(1000 + 37 - 10);
  });

  it('double straddle: UTG 2bb, then UTG+1 4bb', () => {
    const h = base({ straddles: 2, straddleFrom: 'utg' }, [{ p: 5, kind: 'fold' }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }, { p: 3, kind: 'fold' }]);
    const posts = fromAppHand(h).hand.actions.preflop!.filter((a) => a.type === 'post_straddle');
    expect(posts).toEqual([
      { seat: 4, type: 'post_straddle', amount: 10 },
      { seat: 5, type: 'post_straddle', amount: 20 },
    ]);
    // Nobody matched the 20: 10 of it comes back, the pot is 2 + 5 + 10 + 10.
    expect(end(h).winners).toEqual([{ seat: 5, amount: 27 }]);
    expect(end(h).seats.find((s) => s.seat === 5)!.stack).toBe(1000 + 17);
  });

  it('button straddle', () => {
    const h = base({ straddles: 1, straddleFrom: 'btn' }, [{ p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }]);
    expect(fromAppHand(h).hand.actions.preflop!.find((a) => a.type === 'post_straddle')).toEqual({ seat: 1, type: 'post_straddle', amount: 10 });
    expect(end(h).winners).toEqual([{ seat: 1, amount: 12 }]);
    expect(end(h).seats.find((s) => s.seat === 1)!.stack).toBe(1000 + 7);
  });

  it('button ante is dead money paid by the button only', () => {
    const h = base({ ante: 5, anteType: 'btn' }, [{ p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'fold' }, { p: 0, kind: 'fold' }, { p: 1, kind: 'fold' }]);
    const { hand } = fromAppHand(h);
    expect(hand.actions.preflop?.[0]).toEqual({ seat: 1, type: 'post_ante', amount: 5 });
    expect(hand.blinds.ante).toBeUndefined();
    const last = end(h);
    // The BB's unmatched 3 goes back; the pot is the 5 ante + 2 + 2.
    expect(last.winners).toEqual([{ seat: 3, amount: 9 }]);
    expect(last.seats.find((s) => s.seat === 1)!.stack).toBe(995);
    expect(last.seats.find((s) => s.seat === 3)!.stack).toBe(1000 + 7);
  });

  it('bomb pot: everyone in as dead money, the hand starts on the flop', () => {
    const h = base({ bombPot: 20 }, [
      { p: 1, kind: 'check' }, { p: 2, kind: 'check' }, { p: 3, kind: 'check' }, { p: 4, kind: 'check' }, { p: 5, kind: 'check' }, { p: 0, kind: 'check' },
    ], ['2c', '7d', '9h', 'Jc', '3s']);
    const { hand, actionMap } = fromAppHand(h);
    expect(validateHand(hand)).toEqual([]);
    expect(hand.actions.preflop).toHaveLength(6);
    expect(hand.actions.preflop!.every((a) => a.type === 'post_ante' && a.amount === 20)).toBe(true);
    expect(hand.actions.flop).toHaveLength(6);
    expect(actionMap[0]).toEqual({ street: 'flop', index: 0 });
    expect(total(h)).toBe(120);
    // Nobody bets after the flop: AA vs KK at showdown, the aces take the 120.
    const last = end(h);
    expect(last.kind).toBe('showdown');
    expect(last.winners?.map((w) => [w.seat, w.amount])).toEqual([[1, 120]]);
  });

  it('a straddle keeps the action map pointing at the right step', () => {
    const h = base({ straddles: 1 }, [{ p: 4, kind: 'raise', to: 30 }, { p: 5, kind: 'fold' }]);
    const { hand, actionMap } = fromAppHand(h);
    expect(hand.actions.preflop?.[actionMap[0].index]).toEqual({ seat: 5, type: 'raise', amount: 30 });
  });
});
