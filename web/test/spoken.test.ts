import { describe, expect, it } from 'vitest';
import { buildReplay, type HandRecord } from '@livepoker/hand-format';
import { spokenSeat, spokenStep } from '../src/lib/spoken';

const hand: HandRecord = {
  version: 1,
  game: 'NLHE',
  format: 'tournament',
  blinds: { sb: 1000, bb: 2000 },
  tableSize: 3,
  buttonSeat: 1,
  players: [
    { seat: 1, name: 'Vilão', stack: 100000, cards: ['Ah', 'Qh'] },
    { seat: 2, name: 'SB', stack: 80000 },
    { seat: 3, name: 'Hero', stack: 90000, cards: ['Ks', 'Kd'], isHero: true },
  ],
  board: { flop: ['Qd', '8h', '3h'] },
  actions: {
    preflop: [
      { seat: 2, type: 'post_sb', amount: 1000 },
      { seat: 3, type: 'post_bb', amount: 2000 },
      { seat: 1, type: 'raise', amount: 5000 },
      { seat: 2, type: 'fold' },
      { seat: 3, type: 'call' },
    ],
    flop: [{ seat: 3, type: 'check' }],
  },
};

const steps = buildReplay(hand);
const find = (f: (s: (typeof steps)[number]) => boolean) => steps.find(f)!;

describe('spoken table for screen readers', () => {
  it('reads an action as a sentence with the position, in each language', () => {
    const raise = find((s) => s.action?.type === 'raise');
    expect(spokenStep(raise, 2000, 'bb', 'pt')).toMatch(/^Vilão no BTN faz raise para 2,5 BB$/);
    expect(spokenStep(raise, 2000, 'bb', 'en')).toMatch(/^Vilão on the BTN raises to 2.5 BB$/);
    expect(spokenStep(raise, 2000, 'bb', 'es')).toMatch(/^Vilão en BTN hace raise a 2,5 BB$/);
    expect(spokenStep(find((s) => s.action?.type === 'fold'), 2000, 'bb', 'pt')).toBe('SB faz fold');
  });

  it('reads a new street with its cards by name', () => {
    expect(spokenStep(find((s) => s.kind === 'street'), 2000, 'bb', 'pt')).toBe('Flop: Dama de ouros, Oito de copas, Três de copas');
  });

  it('never uses the store-banned words', () => {
    for (const l of ['pt', 'pt-BR', 'es'] as const) for (const s of steps) expect(spokenStep(s, 2000, 'bb', l)).not.toMatch(/apost|apuest/i);
  });

  it('reads a seat: who, stack, cards or face-down', () => {
    const st = find((s) => s.kind === 'street');
    const villain = st.seats.find((s) => s.seat === 1)!;
    expect(spokenSeat(villain, (n) => `${n / 1000}k`, 'pt')).toMatch(/^Vilão no BTN, 95k, /);
  });
});
