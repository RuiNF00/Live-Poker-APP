import { describe, expect, it } from 'vitest';
import { buildReplay, fromAppHand, livePosts, stakesText, validateHand, type AppHand } from '../src';

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

  it('the header names the bomb pot and the button ante', () => {
    const bomb = fromAppHand(base({ bombPot: 20 }, [{ p: 1, kind: 'check' }])).hand;
    expect(stakesText(bomb.blinds)).toBe('2/5 · bomb pot 20');
    const btn = fromAppHand(base({ ante: 5, anteType: 'btn' }, [{ p: 3, kind: 'fold' }])).hand;
    expect(stakesText(btn.blinds)).toBe('2/5 · ante BTN 5');
    expect(stakesText(fromAppHand(base({ ante: 5, anteType: 'bb' }, [])).hand.blinds)).toBe('2/5 · ante 5');
  });

  it('a straddle keeps the action map pointing at the right step', () => {
    const h = base({ straddles: 1 }, [{ p: 4, kind: 'raise', to: 30 }, { p: 5, kind: 'fold' }]);
    const { hand, actionMap } = fromAppHand(h);
    expect(hand.actions.preflop?.[actionMap[0].index]).toEqual({ seat: 5, type: 'raise', amount: 30 });
  });
});

describe('run it twice', () => {
  // Folds to the CO (KK), who jams; the button (AA, hero) calls. Seats: BTN 1, CO 6.
  const jam = (board: string[], board2?: string[], extra: Partial<AppHand> = {}): AppHand => ({
    ...base({}, [{ p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'raise', to: 1000 }, { p: 0, kind: 'call' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }], board),
    board2,
    ...extra,
  });

  it('preflop all-in: each run plays for half the pot, one each is a split', () => {
    // Run 1 is blanks (AA holds); run 2 brings a king (KK wins).
    const h = jam(['2c', '7d', '9s', 'Jh', '3c'], ['Ks', '4h', '8d', 'Qc', '5s']);
    const { hand } = fromAppHand(h);
    expect(validateHand(hand)).toEqual([]);
    const last = end(h);
    expect(last.kind).toBe('showdown');
    expect(last.runs?.map((r) => r.board)).toEqual([
      ['2c', '7d', '9s', 'Jh', '3c'],
      ['Ks', '4h', '8d', 'Qc', '5s'],
    ]);
    // 1000 + 1000 + blinds 7 = 2007: the odd chip goes with the first run.
    expect(last.runs?.[0].winners).toEqual([{ seat: 1, amount: 1004, handLabel: expect.any(String) }]);
    expect(last.runs?.[1].winners.map((w) => [w.seat, w.amount])).toEqual([[6, 1003]]);
    expect(last.winners?.map((w) => [w.seat, w.amount]).sort()).toEqual([[1, 1004], [6, 1003]]);
    expect(last.seats.find((s) => s.seat === 1)!.stack).toBe(1004);
  });

  it('turn all-in: the runs share the flop and turn', () => {
    const h = base({}, [
      { p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'call' }, { p: 0, kind: 'call' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'check' },
      { p: 2, kind: 'check' }, { p: 5, kind: 'check' }, { p: 0, kind: 'check' },
      { p: 2, kind: 'check' }, { p: 5, kind: 'bet', to: 995 }, { p: 0, kind: 'call' }, { p: 2, kind: 'fold' },
    ], ['2c', '7d', '9s', 'Jh', '3c']);
    h.board2 = ['Ks'];
    const last = end(h);
    expect(last.runs?.[1].board).toEqual(['2c', '7d', '9s', 'Jh', 'Ks']);
    expect(last.runs?.[0].winners.map((w) => w.seat)).toEqual([1]);
    expect(last.runs?.[1].winners.map((w) => w.seat)).toEqual([6]);
  });

  it('river all-in or a missing second board: one board, as before', () => {
    expect(end(jam(['2c', '7d', '9s', 'Jh', '3c'], ['Ks', '4h'])).runs).toBeUndefined();
    expect(end(jam(['2c', '7d', '9s', 'Jh', '3c'], [])).runs).toBeUndefined();
    expect(end(jam(['2c', '7d', '9s', 'Jh', '3c'])).winners).toEqual([{ seat: 1, amount: 2007, handLabel: expect.any(String) }]);
  });

  it('unknown cards: manual winners per run', () => {
    const h = jam(['2c', '7d', '9s', 'Jh', '3c'], ['Ks', '4h', '8d', 'Qc', '5s'], { winners: [5], winners2: [5] });
    h.players[5] = { ...h.players[5], cards: undefined };
    const last = end(h);
    expect(last.runs?.map((r) => r.winners.map((w) => [w.seat, w.amount]))).toEqual([[[6, 1004]], [[6, 1003]]]);
  });

  it('rejects a second board that reuses a card', () => {
    const { hand } = fromAppHand(jam(['2c', '7d', '9s', 'Jh', '3c'], ['2c', '4h', '8d', 'Qc', '5s']));
    expect(validateHand(hand)).toContain('duplicate card 2c');
  });
});

describe('run it twice in the action log', () => {
  it('says what each board paid', async () => {
    const { describeStep } = await import('../src');
    const h = base({}, [{ p: 3, kind: 'fold' }, { p: 4, kind: 'fold' }, { p: 5, kind: 'raise', to: 1000 }, { p: 0, kind: 'call' }, { p: 1, kind: 'fold' }, { p: 2, kind: 'fold' }], ['2c', '7d', '9s', 'Jh', '3c']);
    h.board2 = ['Ks', '4h', '8d', 'Qc', '5s'];
    const text = describeStep(end(h), 5, 'chips', 'pt');
    expect(text).toMatch(/^Board 1: BTN ganha 1004 .* · Board 2: CO ganha 1003 /);
  });
});
