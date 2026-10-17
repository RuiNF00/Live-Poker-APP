import type { HandRecord } from './types';

/** Tournament hand used for the demo share page and tests. */
export const SAMPLE_TOURNAMENT_HAND: HandRecord = {
  version: 1,
  game: 'NLHE',
  format: 'tournament',
  blinds: { sb: 1000, bb: 2000, ante: 2000, bbAnte: true },
  tableSize: 9,
  buttonSeat: 6,
  players: [
    { seat: 1, name: 'Miguel', stack: 84000 },
    { seat: 2, name: 'Ana', stack: 152000 },
    { seat: 3, stack: 61000 },
    { seat: 4, name: 'Reg alemão', stack: 230000 },
    { seat: 5, stack: 47000 },
    { seat: 6, name: 'Hero', stack: 118000, cards: ['Ah', 'Qh'], isHero: true },
    { seat: 7, name: 'João', stack: 96000 },
    { seat: 8, name: 'Big stack', stack: 310000, cards: ['Kc', 'Kd'] },
    { seat: 9, stack: 73000 },
  ],
  board: { flop: ['Qd', '7h', '3h'], turn: '2c', river: 'Jh' },
  actions: {
    preflop: [
      { seat: 9, type: 'fold' },
      { seat: 1, type: 'fold' },
      { seat: 2, type: 'fold' },
      { seat: 3, type: 'fold' },
      { seat: 4, type: 'raise', amount: 4500 },
      { seat: 5, type: 'fold' },
      { seat: 6, type: 'call' },
      { seat: 7, type: 'fold' },
      { seat: 8, type: 'raise', amount: 17000 },
      { seat: 4, type: 'fold' },
      { seat: 6, type: 'call' },
    ],
    flop: [
      { seat: 8, type: 'bet', amount: 12000 },
      { seat: 6, type: 'call' },
    ],
    turn: [
      { seat: 8, type: 'bet', amount: 38000 },
      { seat: 6, type: 'allin' },
      { seat: 8, type: 'call' },
    ],
    river: [],
  },
  tournament: { name: 'Estoril Poker Series Main Event', stage: 'middle', level: 14, playersLeft: 212, paidPlaces: 120 },
  tags: ['3-bet pot', 'Cooler?'],
  notes: 'Devia ter feito 4-bet preflop?',
  location: 'Casino Estoril',
};
