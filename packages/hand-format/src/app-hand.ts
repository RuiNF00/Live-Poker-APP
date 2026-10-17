// Adapter for the mobile app's hand model (src/poker/types.ts `Hand`, v1), which is the
// source of truth for stored and shared hands. Shared payloads arrive in that shape; the
// web replayer converts them to a HandRecord here.

import { impliedPosts } from './replay';
import type { Action, Card, HandRecord, Street, TournamentStage } from './types';
import { STREETS } from './types';

export interface AppHandAction {
  p: number;
  kind: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  to?: number;
}

export interface AppHand {
  v: 1;
  id?: string;
  game: {
    kind: 'mtt' | 'cash';
    name: string;
    stage?: 'early' | 'mid' | 'bubble' | 'itm' | 'ft' | 'hu';
    level?: number;
    sb: number;
    bb: number;
    ante: number;
    anteType: 'none' | 'bb' | 'all' | 'btn';
    currency?: string;
    buyIn?: number;
    playersLeft?: number;
    venue?: string;
    /** Live straddles, each double the last: from UTG onwards, or one on the button. */
    straddles?: number;
    straddleFrom?: 'utg' | 'btn';
    /** Bomb pot: everyone puts this in as dead money and the hand starts on the flop. */
    bombPot?: number;
  };
  players: { name: string; stack: number; cards?: string[] }[];
  button: number;
  hero: number;
  actions: AppHandAction[];
  board: string[];
  /** Run it twice: the second board (not replayed yet). */
  board2?: string[];
  tags?: string[];
  notes?: string;
  title?: string;
  winners?: number[];
  createdAt?: number;
}

export function isAppHand(x: unknown): x is AppHand {
  return !!x && typeof x === 'object' && (x as AppHand).v === 1 && Array.isArray((x as AppHand).actions);
}

const STAGE: Record<string, TournamentStage> = {
  early: 'early',
  mid: 'middle',
  bubble: 'bubble',
  itm: 'itm',
  ft: 'final_table',
  hu: 'heads_up',
};

export interface Converted {
  hand: HandRecord;
  /** Flat app action index -> { street, index in that street }. */
  actionMap: { street: Street; index: number }[];
}

/**
 * Forced bets for the live cases the blinds alone can't describe (button ante,
 * straddles, bomb pot), in app player indexes; null when the usual blinds and
 * antes say it all. Mirrors initialState / straddleSeats in the app's engine.
 */
export function livePosts(a: AppHand): { p: number; type: Action['type']; amount: number }[] | null {
  const g = a.game;
  const n = a.players.length;
  if (g.bombPot && g.bombPot > 0) return a.players.map((_, p) => ({ p, type: 'post_ante' as const, amount: g.bombPot! }));
  const k = Math.floor(g.straddles ?? 0);
  const straddled = n >= 3 && k > 0;
  if (!straddled && g.anteType !== 'btn') return null;
  const sb = n === 2 ? a.button : (a.button + 1) % n;
  const bb = n === 2 ? (a.button + 1) % n : (a.button + 2) % n;
  const out: { p: number; type: Action['type']; amount: number }[] = [];
  if (g.ante > 0) {
    if (g.anteType === 'all') for (let p = 0; p < n; p++) out.push({ p, type: 'post_ante', amount: g.ante });
    if (g.anteType === 'bb') out.push({ p: bb, type: 'post_ante', amount: g.ante });
    if (g.anteType === 'btn') out.push({ p: a.button, type: 'post_ante', amount: g.ante });
  }
  if (g.sb) out.push({ p: sb, type: 'post_sb', amount: g.sb });
  out.push({ p: bb, type: 'post_bb', amount: g.bb });
  if (straddled) {
    if (g.straddleFrom === 'btn') out.push({ p: a.button, type: 'post_straddle', amount: g.bb * 2 });
    else for (let j = 0; j < Math.min(k, n - 3); j++) out.push({ p: (bb + 1 + j) % n, type: 'post_straddle', amount: g.bb * 2 ** (j + 1) });
  }
  return out;
}

/** Converts an app Hand; seats are player index + 1. Throws on malformed input. */
export function fromAppHand(a: AppHand): Converted {
  const n = a.players.length;
  const seat = (p: number) => p + 1;
  const g = a.game;
  const hand: HandRecord = {
    version: 1,
    game: a.players.some((p) => (p.cards?.length ?? 0) > 2) ? 'PLO' : 'NLHE',
    format: g.kind === 'mtt' ? 'tournament' : 'cash',
    currency: g.currency,
    blinds: {
      sb: g.sb,
      bb: g.bb,
      ante: g.anteType === 'none' ? undefined : g.ante || undefined,
      bbAnte: g.anteType === 'bb',
    },
    tableSize: Math.max(n, 2),
    buttonSeat: seat(a.button),
    players: a.players.map((p, i) => ({
      seat: seat(i),
      name: p.name || undefined,
      stack: p.stack,
      cards: p.cards?.length ? (p.cards as Card[]) : null,
      isHero: i === a.hero,
    })),
    board: {
      flop: a.board.length >= 3 ? (a.board.slice(0, 3) as [Card, Card, Card]) : undefined,
      turn: (a.board[3] as Card) || undefined,
      river: (a.board[4] as Card) || undefined,
    },
    actions: {},
    winnerSeats: a.winners?.map(seat),
    tournament:
      g.kind === 'mtt'
        ? { name: g.name || undefined, stage: g.stage && STAGE[g.stage], level: g.level, playersLeft: g.playersLeft, buyIn: g.buyIn }
        : undefined,
    tags: a.tags,
    notes: a.notes || undefined,
    location: g.venue || (g.kind === 'cash' ? g.name : undefined) || undefined,
    playedAt: a.createdAt ? new Date(a.createdAt).toISOString() : undefined,
  };

  // The app stores one flat action list; split it into streets by replaying the betting.
  const stacks = a.players.map((p) => p.stack);
  const bets = new Array(n).fill(0);
  const folded = new Array(n).fill(false);
  let acted = new Array(n).fill(false);
  // Live cases list their forced bets on the record, so the replay doesn't guess them from the blinds.
  const explicit = livePosts(a);
  const posts: Action[] = explicit
    ? explicit.map((x) => ({ seat: seat(x.p), type: x.type, amount: x.amount }))
    : impliedPosts(hand);
  for (const post of posts) {
    const i = post.seat - 1;
    const paid = Math.min(post.amount ?? 0, stacks[i]);
    stacks[i] -= paid;
    if (post.type !== 'post_ante') bets[i] += paid;
  }
  if (explicit) {
    hand.blinds.ante = undefined;
    hand.blinds.bbAnte = false;
    if (g.bombPot && g.bombPot > 0) hand.blinds.sb = 0;
  }

  // A bomb pot has no preflop betting: the first action is on the flop.
  let street = g.bombPot && g.bombPot > 0 ? 1 : 0;
  const actionMap: Converted['actionMap'] = [];
  const perStreet: Action[][] = [explicit ? posts.slice() : [], [], [], []];
  const live = () => folded.filter((f) => !f).length;

  for (const act of a.actions) {
    if (street > 3 || live() < 2) break;
    const i = act.p;
    if (i < 0 || i >= n) throw new Error(`action for unknown player ${i}`);
    const max = Math.max(...bets);
    let action: Action;
    if (act.kind === 'fold') {
      folded[i] = true;
      action = { seat: seat(i), type: 'fold' };
    } else if (act.kind === 'check') {
      action = { seat: seat(i), type: 'check' };
    } else if (act.kind === 'call') {
      const paid = Math.min(max - bets[i], stacks[i]);
      stacks[i] -= paid;
      bets[i] += paid;
      action = { seat: seat(i), type: stacks[i] === 0 && paid > 0 ? 'allin' : 'call' };
      if (action.type === 'allin') action.amount = bets[i];
    } else {
      const to = Math.min(act.to ?? max, bets[i] + stacks[i]);
      stacks[i] -= to - bets[i];
      bets[i] = to;
      action = { seat: seat(i), type: stacks[i] === 0 ? 'allin' : act.kind, amount: to };
      if (to > max) acted = new Array(n).fill(false);
    }
    acted[i] = true;
    actionMap.push({ street: STREETS[street], index: perStreet[street].length });
    perStreet[street].push(action);

    const top = Math.max(...bets);
    const closed = a.players.every((_, j) => folded[j] || stacks[j] === 0 || (acted[j] && bets[j] === top));
    if (closed && live() >= 2) {
      street++;
      bets.fill(0);
      acted = new Array(n).fill(false);
    }
  }

  STREETS.forEach((s, k) => {
    if (perStreet[k].length) hand.actions[s] = perStreet[k];
  });
  if (!hand.actions.preflop) hand.actions.preflop = [];
  return { hand, actionMap };
}
