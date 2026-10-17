import type { Session } from '@/store/types';

import { replay } from './engine';
import type { GameInfo, Hand } from './types';

export const MTT_LEVELS: [number, number][] = [
  [100, 200], [150, 300], [200, 400], [250, 500], [300, 600], [400, 800], [500, 1000], [600, 1200],
  [800, 1600], [1000, 2000], [1200, 2400], [1500, 3000], [2000, 4000], [2500, 5000], [3000, 6000],
  [4000, 8000], [5000, 10000], [6000, 12000], [8000, 16000], [10000, 20000], [15000, 30000], [20000, 40000],
];
export const CASH_LEVELS: [number, number][] = [
  [1, 2], [1, 3], [2, 3], [2, 5], [5, 5], [5, 10], [10, 20], [25, 50],
];

export function defaultGame(kind: 'mtt' | 'cash', currency = '€'): GameInfo {
  return kind === 'mtt'
    ? { kind, name: '', sb: 100, bb: 200, ante: 200, anteType: 'bb', currency, stage: 'early', level: 1 }
    : { kind, name: '', sb: 1, bb: 2, ante: 0, anteType: 'none', currency };
}

/** Hands this close together are taken to be at the same table. */
const SAME_TABLE_MS = 6 * 3600 * 1000;

export function newHand(opts: {
  id: string;
  session?: Session | null;
  last?: Hand | null;
  tableSize?: number;
  currency?: string;
}): Hand {
  const { session, last } = opts;
  let game: GameInfo;
  let n: number;
  let stack: number;
  let names: string[] = [];
  if (session) {
    game = {
      kind: session.kind,
      name: session.name,
      venue: session.venue,
      sb: session.sb,
      bb: session.bb,
      ante: session.ante,
      anteType: session.anteType,
      level: session.level,
      stage: session.stage,
      currency: session.currency,
      buyIn: session.buyIn,
    };
    n = session.tableSize;
    stack = session.stack;
    names = session.roster;
  } else if (last) {
    game = { ...last.game };
    n = last.players.length;
    // Carry hero's stack over from where the last hand ended.
    const r = replay(last);
    const s = r.final;
    const end = s.stacks[last.hero] + (r.result ? r.result.won[last.hero] : s.bets[last.hero]);
    stack = end > 0 ? end : last.players[last.hero].stack;
    // Same table a moment ago: the villains are still in their seats.
    if (last.hero === 0 && Date.now() - last.createdAt < SAME_TABLE_MS) names = last.players.map((p) => p.name);
  } else {
    game = defaultGame('mtt', opts.currency);
    n = opts.tableSize ?? 9;
    stack = game.bb * 100;
  }
  n = Math.max(2, Math.min(10, n));
  const now = Date.now();
  return {
    v: 1,
    id: opts.id,
    createdAt: now,
    updatedAt: now,
    sessionId: session?.id,
    game,
    players: Array.from({ length: n }, (_, i) => ({
      name: i === 0 ? 'Hero' : names[i] ?? '',
      stack: stack || game.bb * 100,
    })),
    button: 0,
    hero: 0,
    actions: [],
    board: [],
    tags: [],
    notes: '',
  };
}

/** Change table size keeping hero at index 0 and the same stacks. */
export function resizeTable(hand: Hand, n: number): Hand {
  const players = Array.from({ length: n }, (_, i) => hand.players[i] ?? { name: '', stack: hand.players[hand.hero].stack });
  return { ...hand, players, button: Math.min(hand.button, n - 1), actions: [], winners: undefined };
}

/** New blinds before any action: keep stacks at the same depth in big blinds. */
export function rescaleStacks(hand: Hand, game: GameInfo): Hand {
  if (hand.actions.length || !hand.game.bb || !game.bb || game.bb === hand.game.bb) return { ...hand, game };
  const f = game.bb / hand.game.bb;
  return { ...hand, game, players: hand.players.map((p) => ({ ...p, stack: Math.max(game.bb, Math.round(p.stack * f)) })) };
}

/** Tournament blinds went up: the next level in MTT_LEVELS, with the ante kept at the same share of the big blind. Null past the last one. */
export function nextLevel(game: GameInfo): GameInfo | null {
  if (game.kind !== 'mtt') return null;
  const at = MTT_LEVELS.find(([, bb]) => bb > game.bb);
  if (!at) return null;
  const [sb, bb] = at;
  const ante = game.ante && game.bb ? Math.round((game.ante * bb) / game.bb) : 0;
  return { ...game, sb, bb, ante, level: game.level ? game.level + 1 : undefined };
}
