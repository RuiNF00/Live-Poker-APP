import type { Session } from '@/store/types';

import { replay } from './engine';
import type { GameInfo, Hand, Player } from './types';

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

/**
 * The first hand ever, with no session to copy from: the game the player said
 * they play on first run (tournament, or cash at their stakes).
 */
export function gameForPlays(plays: string | null | undefined, currency = '€'): GameInfo | null {
  if (!plays) return null;
  if (plays.startsWith('mtt')) return defaultGame('mtt', currency);
  const blinds: Record<string, [number, number]> = { cash1: [1, 2], cash2: [3, 5], cash3: [10, 20], cash4: [50, 100] };
  const b = blinds[plays];
  return b ? { ...defaultGame('cash', currency), sb: b[0], bb: b[1] } : null;
}

/** Hands this close together are taken to be at the same table. */
const SAME_TABLE_MS = 6 * 3600 * 1000;

/**
 * The last hand was at this same table: same session (or, outside a session,
 * a few hours ago), same table size and hero in seat 0. Its players, stacks and
 * button carry over.
 */
export function sameTable(last: Hand | null | undefined, session?: Session | null): last is Hand {
  if (!last || last.hero !== 0) return false;
  // A table-size change on the session means a new table.
  if (session) return last.sessionId === session.id && last.players.length === session.tableSize;
  return !last.sessionId && Date.now() - last.createdAt < SAME_TABLE_MS;
}

/** Everyone's stack once the hand is over (or as it stands, if it wasn't finished). */
export function endStacks(hand: Hand): number[] {
  const r = replay(hand);
  const s = r.final;
  return hand.players.map((_, i) => s.stacks[i] + (r.result ? r.result.won[i] : s.bets[i]));
}

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
  const carry = sameTable(last, session);
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
    // Straddles and bomb pots belong to one hand, never carried over.
    game = { ...last.game, straddles: undefined, straddleFrom: undefined, bombPot: undefined };
    n = last.players.length;
    // Carry hero's stack over from where the last hand ended.
    const r = replay(last);
    const s = r.final;
    const end = s.stacks[last.hero] + (r.result ? r.result.won[last.hero] : s.bets[last.hero]);
    stack = end > 0 ? end : last.players[last.hero].stack;
  } else {
    game = defaultGame('mtt', opts.currency);
    n = opts.tableSize ?? 9;
    stack = game.bb * 100;
  }
  n = Math.max(2, Math.min(10, n));
  const fresh = stack || game.bb * 100;
  let players: Player[] = Array.from({ length: n }, (_, i) => ({ name: i === 0 ? 'Hero' : names[i] ?? '', stack: fresh }));
  let button = 0;
  if (carry) {
    // Same table: everyone stays in their seat with the stack they ended on,
    // a busted seat gets a new player, and the button moves one seat on.
    const ends = endStacks(last);
    players = last.players.map((p, i) => (ends[i] > 0 ? { name: p.name, stack: ends[i], ...(p.playerId ? { playerId: p.playerId } : {}) } : { name: '', stack: i === 0 ? fresh : p.stack }));
    button = (last.button + 1) % last.players.length;
    // Hero's stack on the session screen is the latest word (saving a hand
    // writes it there too, and the player may have corrected it since).
    if (session && session.stack > 0) players[0] = { ...players[0], stack: session.stack };
  }
  const now = Date.now();
  return {
    v: 1,
    id: opts.id,
    createdAt: now,
    updatedAt: now,
    sessionId: session?.id,
    game,
    players,
    button,
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

/** Someone left: their seat goes, everyone else keeps their place and the button stays on the same player. */
export function removeSeat(hand: Hand, i: number): Hand {
  const n = hand.players.length;
  if (n <= 2 || i === hand.hero) return hand;
  const players = hand.players.filter((_, k) => k !== i);
  const shift = (k: number) => (k > i ? k - 1 : k);
  const button = i === hand.button ? shift((i - 1 + n) % n) : shift(hand.button);
  return { ...hand, players, hero: shift(hand.hero), button, actions: [], board: [], winners: undefined };
}

/** Someone sat down to the left of seat i, with a fresh stack. */
export function addSeat(hand: Hand, i: number, stack: number): Hand {
  const n = hand.players.length;
  if (n >= 10) return hand;
  const players = [...hand.players.slice(0, i + 1), { name: '', stack }, ...hand.players.slice(i + 1)];
  const shift = (k: number) => (k > i ? k + 1 : k);
  return { ...hand, players, hero: shift(hand.hero), button: shift(hand.button), actions: [], board: [], winners: undefined };
}

/** Two players changed seats (or one moved to the other's seat). */
export function swapSeats(hand: Hand, a: number, b: number): Hand {
  if (a === b || a === hand.hero || b === hand.hero) return hand;
  const players = [...hand.players];
  [players[a], players[b]] = [players[b], players[a]];
  return { ...hand, players, actions: [], board: [], winners: undefined };
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
