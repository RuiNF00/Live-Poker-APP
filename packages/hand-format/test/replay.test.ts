import { describe, expect, it } from 'vitest';
import {
  SAMPLE_TOURNAMENT_HAND,
  bestHand,
  buildReplay,
  describeStep,
  evaluate5,
  formatChips,
  impliedPosts,
  positionsFor,
  validateHand,
  type HandRecord,
} from '../src';

describe('evaluator', () => {
  it('ranks categories', () => {
    expect(evaluate5(['Ah', 'Kh', 'Qh', 'Jh', 'Th']).category).toBe('straight_flush');
    expect(evaluate5(['5s', '4d', '3c', '2h', 'Ah']).category).toBe('straight');
    expect(evaluate5(['Ks', 'Kd', 'Kc', '7h', '7d']).category).toBe('full_house');
    expect(evaluate5(['Ks', 'Kd', '7c', '7h', '2d']).score).toBeGreaterThan(evaluate5(['Qs', 'Qd', 'Jc', 'Jh', 'Ad']).score);
    expect(evaluate5(['6s', '5d', '4c', '3h', '2d']).score).toBeGreaterThan(evaluate5(['5s', '4d', '3c', '2h', 'Ah']).score);
  });
  it('PLO uses exactly two hole cards', () => {
    // Four hearts on board + one heart in hand is not a flush in PLO.
    const v = bestHand(['Ah', 'Ks', 'Kd', '2c'], ['9h', '8h', '4h', '3h', 'Kc'], 'PLO');
    expect(v?.category).toBe('trips');
    expect(bestHand(['Ah', 'Ks', 'Kd', '2c'], ['9h', '8h', '4h', '3h', 'Kc'], 'NLHE')?.category).toBe('flush');
  });
});

describe('replay of sample tournament hand', () => {
  const steps = buildReplay(SAMPLE_TOURNAMENT_HAND);
  const last = steps[steps.length - 1];

  it('has positions from the button', () => {
    const pos = positionsFor(SAMPLE_TOURNAMENT_HAND);
    expect(pos.get(6)).toBe('BTN');
    expect(pos.get(7)).toBe('SB');
    expect(pos.get(8)).toBe('BB');
    expect(pos.get(9)).toBe('UTG');
    expect(pos.get(5)).toBe('CO');
  });

  it('posts blinds and the BB ante on the start step', () => {
    const start = steps[0];
    expect(start.pot).toBe(2000);
    expect(start.totalPot).toBe(5000);
    expect(start.seats.find((s) => s.seat === 8)!.stack).toBe(306000);
  });

  it('builds every step', () => {
    expect(steps).toHaveLength(21);
    expect(steps.filter((s) => s.kind === 'street').map((s) => s.street)).toEqual(['flop', 'turn', 'river']);
  });

  it('pays the flush the whole pot', () => {
    expect(last.kind).toBe('showdown');
    expect(last.pot).toBe(243500);
    expect(last.winners).toEqual([{ seat: 6, amount: 243500, handLabel: 'Cor' }]);
    expect(last.seats.find((s) => s.seat === 6)!.stack).toBe(243500);
    const chipsBefore = SAMPLE_TOURNAMENT_HAND.players.reduce((n, p) => n + p.stack, 0);
    expect(last.seats.reduce((n, s) => n + s.stack, 0)).toBe(chipsBefore);
  });

  it('hides villain cards until showdown', () => {
    const turnBet = steps.find((s) => s.street === 'turn' && s.kind === 'action')!;
    expect(turnBet.seats.find((s) => s.seat === 8)!.showCards).toBe(false);
    expect(turnBet.seats.find((s) => s.seat === 6)!.showCards).toBe(true);
    expect(last.seats.find((s) => s.seat === 8)!.showCards).toBe(true);
  });

  it('describes steps', () => {
    expect(describeStep(steps[5], 2000)).toBe('Reg alemão Raise 4500');
    expect(describeStep(steps[5], 2000, 'chips', 'en')).toBe('Reg alemão Raise 4,500');
    expect(describeStep(steps[12], 2000)).toBe('Flop Q♦ 7♥ 3♥');
    expect(describeStep(steps[5], 2000, 'bb')).toBe('Reg alemão Raise 2.3 BB');
    expect(describeStep(last, 2000)).toBe('Hero ganha 244k (Cor)');
  });
});

const base = (over: Partial<HandRecord>): HandRecord => ({
  version: 1,
  game: 'NLHE',
  format: 'cash',
  blinds: { sb: 1, bb: 2 },
  tableSize: 6,
  buttonSeat: 1,
  players: [],
  actions: {},
  ...over,
});

describe('edge cases', () => {
  it('heads-up: button posts the small blind', () => {
    const h = base({ players: [{ seat: 1, stack: 100 }, { seat: 2, stack: 100 }] });
    expect(impliedPosts(h)).toEqual([
      { seat: 1, type: 'post_sb', amount: 1 },
      { seat: 2, type: 'post_bb', amount: 2 },
    ]);
  });

  it('returns an uncalled bet and awards the pot on a fold', () => {
    const h = base({
      players: [{ seat: 1, stack: 100 }, { seat: 2, stack: 100 }, { seat: 3, stack: 100 }],
      actions: { preflop: [{ seat: 1, type: 'raise', amount: 6 }, { seat: 2, type: 'fold' }, { seat: 3, type: 'fold' }] },
    });
    const steps = buildReplay(h);
    const end = steps[steps.length - 1];
    expect(end.kind).toBe('end');
    expect(end.winners).toEqual([{ seat: 1, amount: 5 }]);
    expect(end.seats.find((s) => s.seat === 1)!.stack).toBe(103);
  });

  it('splits main and side pots in a three-way all-in', () => {
    const h = base({
      buttonSeat: 3,
      players: [
        { seat: 1, stack: 50, cards: ['As', 'Ad'] },
        { seat: 2, stack: 200, cards: ['Ks', 'Kd'] },
        { seat: 3, stack: 200, cards: ['Qs', 'Qd'] },
      ],
      board: { flop: ['2c', '7h', '9d'], turn: '3s', river: '4h' },
      actions: {
        preflop: [
          { seat: 3, type: 'allin' },
          { seat: 1, type: 'call' },
          { seat: 2, type: 'call' },
        ],
      },
    });
    const steps = buildReplay(h);
    const end = steps[steps.length - 1];
    const won = Object.fromEntries(end.winners!.map((w) => [w.seat, w.amount]));
    expect(won).toEqual({ 1: 150, 2: 300 });
    // Runout reveals cards as soon as the flop comes
    expect(steps.find((s) => s.kind === 'street')!.seats.every((s) => s.showCards)).toBe(true);
  });

  it('splits a chopped pot', () => {
    const h = base({
      players: [
        { seat: 1, stack: 100, cards: ['Ac', '2d'] },
        { seat: 2, stack: 100, cards: ['Ad', '3c'] },
      ],
      board: { flop: ['Ks', 'Kh', 'Qs'], turn: 'Qh', river: 'Js' },
      actions: { preflop: [{ seat: 1, type: 'call' }, { seat: 2, type: 'check' }], flop: [], turn: [], river: [] },
    });
    const end = buildReplay(h).at(-1)!;
    expect(end.winners!.map((w) => w.amount)).toEqual([2, 2]);
  });

  it('picked winners without cards: the short all-in takes the main pot, the deeper winner the side pot', () => {
    const h = base({
      players: [
        { seat: 1, stack: 50 },
        { seat: 2, stack: 120 },
        { seat: 3, stack: 200, cards: ['8s', '8d'], isHero: true },
      ],
      board: { flop: ['2c', '7d', '9s'], turn: 'Th', river: '3c' },
      actions: { preflop: [{ seat: 1, type: 'allin', amount: 50 }, { seat: 2, type: 'allin', amount: 120 }, { seat: 3, type: 'call' }], flop: [], turn: [], river: [] },
      winnerSeats: [1, 2],
    });
    const won = Object.fromEntries(buildReplay(h).at(-1)!.winners!.map((w) => [w.seat, w.amount]));
    expect(won).toEqual({ 1: 150, 2: 140 });
  });

  it('splits a whole-euro cash chop to the cent: €1 at 0.25/0.50 is 0.50 + 0.50', () => {
    const h = base({
      blinds: { sb: 0.25, bb: 0.5 },
      buttonSeat: 2,
      players: [
        { seat: 1, stack: 50, cards: ['Ac', '2d'] },
        { seat: 2, stack: 50, cards: ['Ad', '3c'] },
      ],
      board: { flop: ['Ks', 'Kh', 'Qs'], turn: 'Qh', river: 'Js' },
      actions: { preflop: [{ seat: 2, type: 'call' }, { seat: 1, type: 'check' }], flop: [], turn: [], river: [] },
    });
    expect(buildReplay(h).at(-1)!.winners!.map((w) => w.amount)).toEqual([0.5, 0.5]);
  });

  it('splits a chopped pot with cents to the cent', () => {
    const h = base({
      blinds: { sb: 0.25, bb: 0.5 },
      players: [
        { seat: 1, stack: 50, cards: ['Ac', '2d'] },
        { seat: 2, stack: 50, cards: ['Ad', '3c'] },
      ],
      board: { flop: ['Ks', 'Kh', 'Qs'], turn: 'Qh', river: 'Js' },
      actions: { preflop: [{ seat: 1, type: 'raise', amount: 1.25 }, { seat: 2, type: 'call' }], flop: [], turn: [], river: [] },
    });
    expect(buildReplay(h).at(-1)!.winners!.map((w) => w.amount)).toEqual([1.25, 1.25]);
    const three = base({
      blinds: { sb: 0.25, bb: 0.5 },
      players: [
        { seat: 1, stack: 50, cards: ['Ac', '2d'] },
        { seat: 2, stack: 50, cards: ['Ad', '3c'] },
      ],
      board: { flop: ['Ks', 'Kh', 'Qs'], turn: 'Qh', river: 'Js' },
      actions: { preflop: [{ seat: 1, type: 'raise', amount: 1.25 }, { seat: 2, type: 'raise', amount: 1.625 }, { seat: 1, type: 'call' }], flop: [], turn: [], river: [] },
    });
    expect(buildReplay(three).at(-1)!.winners!.map((w) => w.amount)).toEqual([1.63, 1.62]);
  });
});

describe('validateHand', () => {
  it('accepts the sample', () => expect(validateHand(SAMPLE_TOURNAMENT_HAND)).toEqual([]));
  it('rejects duplicate cards and junk', () => {
    const bad = structuredClone(SAMPLE_TOURNAMENT_HAND);
    bad.board!.flop = ['Ah', '7h', '3h'];
    expect(validateHand(bad)).toContain('duplicate card Ah');
    expect(validateHand('x')).toEqual(['not an object']);
  });
});

describe('formatting and positions match the app', () => {
  it('formats chips like the app', () => {
    expect(formatChips(1380)).toBe('1380');
    expect(formatChips(9500)).toBe('9500');
    expect(formatChips(1380, 'en')).toBe('1,380');
    expect(formatChips(103_500)).toBe('104k');
    expect(formatChips(12_500)).toBe('12.5k');
    expect(formatChips(1_250_000)).toBe('1.25M');
  });
  it('labels 9-max like the app', () => {
    const hand = structuredClone(SAMPLE_TOURNAMENT_HAND);
    hand.players = Array.from({ length: 9 }, (_, i) => ({ seat: i + 1, stack: 1000, isHero: i === 0 }));
    hand.buttonSeat = 1;
    expect([...positionsFor(hand).values()]).toEqual(['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO']);
  });
});
