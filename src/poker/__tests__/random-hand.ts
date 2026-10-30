// Random hands for the engine tests: every game shape the engine knows (antes, straddles, bomb pots,
// PLO, cent blinds, run it twice, manual winners), played by legal and now and then refused actions,
// and stopped anywhere. Deterministic per seed.

import { FULL_DECK } from '../cards';
import { apply, legal, replay } from '../engine';
import type { AnteType, Hand, HandAction } from '../types';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function randomHand(seed: number): Hand {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const n = 2 + Math.floor(r() * 8);
  const plo = r() < 0.15;
  const cents = r() < 0.2;
  const sb = cents ? 0.25 : pick([1, 2, 5, 100]);
  const bb = sb * 2;
  const deck = [...FULL_DECK].sort(() => r() - 0.5);
  const deal = (k: number) => deck.splice(0, k);
  const bomb = r() < 0.08 ? bb * 2 : undefined;
  const hand: Hand = {
    v: 1,
    id: 'r' + seed,
    createdAt: 0,
    updatedAt: 0,
    game: {
      kind: r() < 0.5 ? 'cash' : 'mtt',
      ...(plo ? { variant: 'plo' as const } : null),
      name: '',
      sb,
      bb,
      ante: r() < 0.3 ? bb : 0,
      anteType: pick<AnteType>(['none', 'bb', 'all', 'btn']),
      currency: '€',
      ...(r() < 0.15 ? { straddles: 1 + Math.floor(r() * 2), straddleFrom: pick(['utg', 'btn'] as const) } : null),
      ...(bomb ? { bombPot: bomb } : null),
    },
    players: Array.from({ length: n }, () => ({ name: '', stack: r() < 0.2 ? bb * (1 + Math.floor(r() * 6)) : bb * (20 + Math.floor(r() * 200)), ...(r() < 0.6 ? { cards: deal(plo ? 4 : 2) } : null) })),
    button: Math.floor(r() * n),
    hero: Math.floor(r() * n),
    actions: [],
    board: [],
    tags: [],
    notes: '',
  };
  const stop = r();
  for (let guard = 0; guard < 80; guard++) {
    const rp = replay(hand);
    const s = rp.final;
    if (rp.invalidAt !== null) break;
    if (s.needsBoard) {
      if (r() < stop * 0.15) break;
      const want = s.street === 'flop' ? 3 : s.street === 'turn' ? 4 : 5;
      hand.board.push(...deal(want - hand.board.length));
      continue;
    }
    const l = legal(s);
    if (!l) break;
    if (r() < stop * 0.05) break;
    let a: HandAction;
    const x = r();
    if (x < 0.03) a = { p: (l.p + 1) % n, kind: 'call' }; // out of turn: refused
    else if (x < 0.06) a = { p: l.p, kind: 'check' }; // refused when facing a bet
    else if (x < 0.2) a = { p: l.p, kind: 'fold' };
    else if (x < 0.6) a = { p: l.p, kind: l.canCheck ? 'check' : 'call' };
    else if (l.canBet || l.canRaise) a = { p: l.p, kind: l.canBet ? 'bet' : 'raise', to: l.minTo + Math.floor(r() * (l.maxTo - l.minTo + 1) * (r() < 0.3 ? 2 : 1)) };
    else a = { p: l.p, kind: 'call' };
    hand.actions.push(a);
    if (!apply(s, a, hand)) break;
  }
  // Run it twice and manual winners now and then, filled or not.
  if (r() < 0.2) hand.board2 = deal(Math.floor(r() * 6));
  if (r() < 0.3) hand.winners = [Math.floor(r() * n)];
  if (hand.board2 && r() < 0.5) hand.winners2 = [Math.floor(r() * n)];
  return hand;
}
