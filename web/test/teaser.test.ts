import { describe, expect, it } from 'vitest';
import { buildReplay, type HandRecord } from '@livepoker/hand-format';
import { challengeTeaser } from '../src/lib/hand';

const hand: HandRecord = {
  version: 1,
  game: 'NLHE',
  format: 'tournament',
  blinds: { sb: 1000, bb: 2000 },
  tableSize: 3,
  buttonSeat: 1,
  players: [
    { seat: 1, name: 'Hero', stack: 100000, cards: ['Ah', 'Qh'], isHero: true },
    { seat: 2, name: 'SB', stack: 80000, cards: ['7c', '7d'] },
    { seat: 3, name: 'BB', stack: 90000, cards: ['Ks', 'Kd'] },
  ],
  board: { flop: ['Qd', '8h', '3h'], turn: '2s', river: 'Jh' },
  actions: {
    preflop: [
      { seat: 2, type: 'post_sb', amount: 1000 },
      { seat: 3, type: 'post_bb', amount: 2000 },
      { seat: 1, type: 'raise', amount: 5000 },
      { seat: 2, type: 'fold' },
      { seat: 3, type: 'call' },
    ],
    flop: [
      { seat: 3, type: 'bet', amount: 8000 },
      { seat: 1, type: 'allin', amount: 95000 },
      { seat: 3, type: 'call' },
    ],
  },
  winners: [{ seat: 1, amount: 190000 }],
  tags: ['Cooler?'],
  notes: 'He had kings',
};

describe('challengeTeaser', () => {
  const spot = { street: 'flop' as const, actionIndex: 1 };
  const teaser = challengeTeaser(hand, spot);
  const text = JSON.stringify(teaser);

  it('drops everything that gives the answer away', () => {
    for (const leak of ['7c', 'Ks', '2s', 'Jh', 'allin', '95000', 'winners', 'Cooler', 'kings']) expect(text).not.toContain(leak);
    expect(teaser.players.find((p) => p.isHero)?.cards).toEqual(['Ah', 'Qh']);
    expect(teaser.board).toEqual({ flop: ['Qd', '8h', '3h'] });
  });

  it('keeps the spot replayable, with the decision as a stand-in that pays nothing', () => {
    const steps = buildReplay(teaser, {});
    const at = steps.findIndex((s) => s.action && s.street === 'flop' && s.action.index === 1);
    expect(at).toBeGreaterThan(0);
    expect(steps[at].action?.paid ?? 0).toBe(0);
    expect(steps[at].facing).toBe(8000);
    // The steps before the decision are the same as in the full hand.
    const full = buildReplay(hand, {});
    expect(steps.slice(0, at).map((s) => s.totalPot)).toEqual(full.slice(0, at).map((s) => s.totalPot));
  });
});
