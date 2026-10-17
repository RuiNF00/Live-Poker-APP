// Betting engine. Replays a Hand's inputs into table states: who acts next,
// what they may do, pots, side pots and payouts. Pure functions, no React.

import { evaluate } from './evaluator';
import type { ActionKind, Hand, HandAction, Street } from './types';

export interface LastAction {
  p: number;
  kind: ActionKind;
  /** Chips added to the pot by this action. */
  added: number;
  /** Street total after the action. */
  to: number;
  allIn: boolean;
}

export interface TableState {
  street: Street;
  stacks: number[];
  bets: number[];
  invested: number[];
  antes: number[];
  /** Chips already collected into the middle (previous streets + antes). */
  pot: number;
  folded: boolean[];
  allIn: boolean[];
  acted: boolean[];
  currentBet: number;
  minRaise: number;
  toAct: number | null;
  lastAggressor: number | null;
  /** Bets/raises on this street so far (0 = unopened). */
  raises: number;
  /** Last preflop raiser, for c-bet labels and tags. */
  pfAggressor: number | null;
  /** Board cards visible in this state. */
  boardCount: number;
  /** A street closed and its board cards have not been entered yet. */
  needsBoard: boolean;
  /** No more betting is possible. */
  bettingDone: boolean;
  /** Everyone but one folded. */
  foldWin: boolean;
  last: LastAction | null;
}

export type StepKind = 'start' | 'action' | 'board' | 'showdown';

export interface Step {
  kind: StepKind;
  street: Street;
  state: TableState;
  actionIndex?: number;
  /** Street the action was taken on (state.street may already be the next one). */
  actStreet?: Street;
}

export interface Pot {
  amount: number;
  eligible: number[];
  winners: number[] | null;
}

export interface HandResult {
  pots: Pot[];
  /** Chips won per player (gross, from pots). */
  won: number[];
  /** Net result per player: won - invested - ante. */
  net: number[];
  resolved: boolean;
  /** Best-hand names at showdown, per player, when known. */
  handNames: (string | null)[];
}

export interface Replay {
  steps: Step[];
  final: TableState;
  /** Index of the first action that could not be applied, if any. */
  invalidAt: number | null;
  result: HandResult | null;
}

const NEXT_STREET: Record<Street, Street | null> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: null,
};
const BOARD_FOR: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

// ─── positions ─────────────────────────────────────────────

const MIDDLE: Record<number, string[]> = {
  0: [],
  1: ['UTG'],
  2: ['UTG', 'CO'],
  3: ['UTG', 'HJ', 'CO'],
  4: ['UTG', 'LJ', 'HJ', 'CO'],
  5: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  6: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
  7: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO'],
};

/** Position label per player index, for n players and the button index. */
export function positions(n: number, button: number): string[] {
  const out = new Array<string>(n).fill('');
  if (n < 2) return out;
  if (n === 2) {
    out[button] = 'BTN';
    out[(button + 1) % n] = 'BB';
    return out;
  }
  out[button] = 'BTN';
  out[(button + 1) % n] = 'SB';
  out[(button + 2) % n] = 'BB';
  const mid = MIDDLE[n - 3] ?? [];
  mid.forEach((label, k) => {
    out[(button + 3 + k) % n] = label;
  });
  return out;
}

/** Preflop acting order labels (UTG first, BB last) for n players. */
export function positionOrder(n: number): string[] {
  if (n === 2) return ['BTN', 'BB'];
  return [...(MIDDLE[n - 3] ?? []), 'BTN', 'SB', 'BB'];
}

/** Button index that puts `hero` at position `label`. */
export function buttonForHeroPosition(n: number, hero: number, label: string): number {
  for (let b = 0; b < n; b++) if (positions(n, b)[hero] === label) return b;
  return 0;
}

export function sbIndex(n: number, button: number) {
  return n === 2 ? button : (button + 1) % n;
}
export function bbIndex(n: number, button: number) {
  return n === 2 ? (button + 1) % n : (button + 2) % n;
}

// ─── state machine ─────────────────────────────────────────

function clone(s: TableState): TableState {
  return {
    ...s,
    stacks: [...s.stacks],
    bets: [...s.bets],
    invested: [...s.invested],
    antes: [...s.antes],
    folded: [...s.folded],
    allIn: [...s.allIn],
    acted: [...s.acted],
    last: s.last ? { ...s.last } : null,
  };
}

function canAct(s: TableState, i: number) {
  return !s.folded[i] && !s.allIn[i];
}

function activeCount(s: TableState) {
  return s.folded.filter((f) => !f).length;
}

function nextFrom(s: TableState, from: number): number | null {
  const n = s.stacks.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (!canAct(s, i)) continue;
    if (!s.acted[i] || s.bets[i] < s.currentBet) return i;
  }
  return null;
}

function put(s: TableState, i: number, amount: number) {
  const a = Math.max(0, Math.min(amount, s.stacks[i]));
  s.stacks[i] -= a;
  s.bets[i] += a;
  s.invested[i] += a;
  if (s.stacks[i] === 0) s.allIn[i] = true;
  return a;
}

export function initialState(hand: Hand): TableState {
  const n = hand.players.length;
  const g = hand.game;
  const s: TableState = {
    street: 'preflop',
    stacks: hand.players.map((p) => Math.max(0, p.stack)),
    bets: new Array(n).fill(0),
    invested: new Array(n).fill(0),
    antes: new Array(n).fill(0),
    pot: 0,
    folded: new Array(n).fill(false),
    allIn: new Array(n).fill(false),
    acted: new Array(n).fill(false),
    currentBet: 0,
    minRaise: g.bb,
    toAct: null,
    lastAggressor: null,
    raises: 0,
    pfAggressor: null,
    boardCount: 0,
    needsBoard: false,
    bettingDone: false,
    foldWin: false,
    last: null,
  };
  const sb = sbIndex(n, hand.button);
  const bb = bbIndex(n, hand.button);
  // Antes are dead money: straight into the middle, never part of a bet.
  const takeAnte = (i: number, amt: number) => {
    const a = Math.min(amt, s.stacks[i]);
    s.stacks[i] -= a;
    s.antes[i] += a;
    s.pot += a;
    if (s.stacks[i] === 0) s.allIn[i] = true;
  };
  if (g.ante > 0 && g.anteType === 'all') for (let i = 0; i < n; i++) takeAnte(i, g.ante);
  if (g.ante > 0 && g.anteType === 'bb') takeAnte(bb, g.ante);
  put(s, sb, g.sb);
  put(s, bb, g.bb);
  s.currentBet = Math.max(s.bets[sb], s.bets[bb], g.bb);
  s.minRaise = g.bb;
  s.toAct = nextFrom(s, bb);
  if (s.toAct === null) closeStreet(s, hand);
  return s;
}

/** Give back the part of the top bet nobody matched. */
function returnUncalled(s: TableState) {
  let top = -1;
  let topBet = 0;
  let second = 0;
  s.bets.forEach((b, i) => {
    if (b > topBet) {
      second = topBet;
      topBet = b;
      top = i;
    } else if (b > second) second = b;
  });
  if (top >= 0 && topBet > second) {
    const back = topBet - second;
    s.bets[top] -= back;
    s.invested[top] -= back;
    s.stacks[top] += back;
    if (s.stacks[top] > 0) s.allIn[top] = false;
  }
}

function collect(s: TableState) {
  returnUncalled(s);
  s.pot += s.bets.reduce((a, b) => a + b, 0);
  s.bets = s.bets.map(() => 0);
}

function closeStreet(s: TableState, hand: Hand) {
  collect(s);
  s.toAct = null;
  if (activeCount(s) <= 1) {
    s.foldWin = true;
    s.bettingDone = true;
    return;
  }
  const actors = s.folded.filter((f, i) => !f && !s.allIn[i]).length;
  const next = NEXT_STREET[s.street];
  if (!next) {
    s.bettingDone = true;
    return;
  }
  if (actors <= 1) s.bettingDone = true;
  advance(s, next, hand);
}

function advance(s: TableState, next: Street, hand: Hand) {
  s.street = next;
  s.currentBet = 0;
  s.minRaise = hand.game.bb;
  s.acted = s.acted.map(() => false);
  s.lastAggressor = null;
  s.raises = 0;
  s.needsBoard = true;
}

export interface Legal {
  p: number;
  toCall: number;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  /** Min/max street total for a bet or raise. */
  minTo: number;
  maxTo: number;
}

export function legal(s: TableState): Legal | null {
  const p = s.toAct;
  if (p === null) return null;
  const toCall = Math.max(0, s.currentBet - s.bets[p]);
  const maxTo = s.bets[p] + s.stacks[p];
  const minTo = Math.min(maxTo, s.currentBet === 0 ? s.minRaise : s.currentBet + s.minRaise);
  return {
    p,
    toCall: Math.min(toCall, s.stacks[p]),
    canCheck: toCall === 0,
    canCall: toCall > 0,
    canBet: s.currentBet === 0 && s.stacks[p] > 0,
    canRaise: s.currentBet > 0 && maxTo > s.currentBet,
    minTo,
    maxTo,
  };
}

/** Apply one action. Returns null when it is not legal in this state. */
export function apply(prev: TableState, a: HandAction, hand: Hand): TableState | null {
  if (prev.toAct === null || a.p !== prev.toAct) return null;
  const s = clone(prev);
  const p = a.p;
  const toCall = Math.max(0, s.currentBet - s.bets[p]);
  let added = 0;
  let kind: ActionKind = a.kind;
  if (kind === 'fold') {
    s.folded[p] = true;
  } else if (kind === 'check') {
    if (toCall > 0) return null;
  } else if (kind === 'call') {
    if (toCall <= 0) {
      kind = 'check';
    } else added = put(s, p, toCall);
  } else {
    const maxTo = s.bets[p] + s.stacks[p];
    const to = Math.min(a.to ?? 0, maxTo);
    if (to <= s.currentBet) {
      // An all-in for less than the bet is a call.
      if (toCall <= 0) return null;
      kind = 'call';
      added = put(s, p, toCall);
    } else {
      const raiseBy = to - s.currentBet;
      kind = s.currentBet === 0 ? 'bet' : 'raise';
      added = put(s, p, to - s.bets[p]);
      if (raiseBy >= s.minRaise) s.minRaise = raiseBy;
      s.currentBet = to;
      s.lastAggressor = p;
      s.raises += 1;
      if (s.street === 'preflop') s.pfAggressor = p;
      // Everyone else must respond to the new amount.
      s.acted = s.acted.map((v, i) => (i === p ? v : false));
    }
  }
  s.acted[p] = true;
  s.last = { p, kind, added, to: s.bets[p], allIn: s.allIn[p] && kind !== 'fold' && kind !== 'check' };
  if (activeCount(s) <= 1) {
    closeStreet(s, hand);
    return s;
  }
  const nxt = nextFrom(s, p);
  if (nxt === null) closeStreet(s, hand);
  else s.toAct = nxt;
  return s;
}

/** Feed newly entered board cards into a state waiting for them. */
export function dealBoard(prev: TableState, hand: Hand): TableState | null {
  if (!prev.needsBoard) return null;
  const want = BOARD_FOR[prev.street];
  if (hand.board.length < want) return null;
  const s = clone(prev);
  s.boardCount = want;
  s.needsBoard = false;
  s.last = null;
  if (s.bettingDone) {
    // All-in run-out: keep dealing without betting.
    const next = NEXT_STREET[s.street];
    if (next) advance(s, next, hand);
    return s;
  }
  s.toAct = nextFrom(s, hand.button);
  if (s.toAct === null) closeStreet(s, hand);
  return s;
}

// ─── replay ────────────────────────────────────────────────

export function replay(hand: Hand): Replay {
  const steps: Step[] = [];
  let s = initialState(hand);
  steps.push({ kind: 'start', street: 'preflop', state: s });
  let invalidAt: number | null = null;

  const flushBoards = () => {
    while (s.needsBoard) {
      const dealt = s.street;
      const d = dealBoard(s, hand);
      if (!d) break;
      s = d;
      steps.push({ kind: 'board', street: dealt, state: s });
    }
  };
  flushBoards();

  for (let i = 0; i < hand.actions.length; i++) {
    if (s.toAct === null) {
      invalidAt = i;
      break;
    }
    const next = apply(s, hand.actions[i], hand);
    if (!next) {
      invalidAt = i;
      break;
    }
    const actStreet = s.street;
    s = next;
    steps.push({ kind: 'action', street: actStreet, state: s, actionIndex: i, actStreet });
    flushBoards();
  }

  let result: HandResult | null = null;
  const complete = s.foldWin || (s.bettingDone && !s.needsBoard && s.boardCount === 5);
  if (complete) {
    result = computeResult(hand, s);
    if (!s.foldWin) steps.push({ kind: 'showdown', street: s.street, state: { ...s, last: null } });
  }
  return { steps, final: s, invalidAt, result };
}

export function computeResult(hand: Hand, s: TableState): HandResult {
  const n = hand.players.length;
  const won = new Array(n).fill(0);
  const handNames: (string | null)[] = new Array(n).fill(null);
  const live = s.folded.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  const deadAntes = s.antes.reduce((a, b) => a + b, 0);
  const pots: Pot[] = [];

  if (live.length === 1) {
    const total = s.pot + s.bets.reduce((a, b) => a + b, 0);
    pots.push({ amount: total, eligible: live, winners: live });
    won[live[0]] = total;
  } else {
    const levels = [...new Set(live.map((i) => s.invested[i]))].sort((a, b) => a - b);
    let prev = 0;
    levels.forEach((L, k) => {
      let amount = 0;
      for (let i = 0; i < n; i++) amount += Math.max(0, Math.min(s.invested[i], L) - Math.min(s.invested[i], prev));
      if (k === 0) amount += deadAntes;
      if (k === levels.length - 1) {
        // Folded chips above the last live level (rare) stay in the last pot.
        for (let i = 0; i < n; i++) amount += Math.max(0, s.invested[i] - Math.max(L, prev));
      }
      const eligible = live.filter((i) => s.invested[i] >= L);
      if (amount > 0) pots.push({ amount, eligible, winners: null });
      prev = L;
    });

    const board = hand.board.slice(0, 5);
    const scores = new Map<number, number>();
    for (const i of live) {
      const c = hand.players[i].cards;
      if (c && c.length === 2 && board.length === 5) {
        const ev = evaluate([...c, ...board]);
        scores.set(i, ev.score);
        handNames[i] = ev.name;
      }
    }
    for (const pot of pots) {
      if (pot.eligible.length === 1) {
        pot.winners = pot.eligible;
      } else if (pot.eligible.every((i) => scores.has(i))) {
        const best = Math.max(...pot.eligible.map((i) => scores.get(i)!));
        pot.winners = pot.eligible.filter((i) => scores.get(i) === best);
      } else if (hand.winners && hand.winners.length) {
        const w = hand.winners.filter((i) => pot.eligible.includes(i));
        pot.winners = w.length ? w : null;
      }
      if (pot.winners) {
        const share = Math.floor(pot.amount / pot.winners.length);
        let odd = pot.amount - share * pot.winners.length;
        for (const w of pot.winners) {
          won[w] += share + (odd > 0 ? 1 : 0);
          if (odd > 0) odd--;
        }
      }
    }
  }
  const resolved = pots.every((p) => p.winners !== null);
  const net = won.map((w, i) => w - s.invested[i] - s.antes[i]);
  return { pots, won, net, resolved, handNames };
}

// ─── helpers for UIs ───────────────────────────────────────

/** What poker players call the next bet/raise here: Open, 3-Bet, C-bet… */
export function raiseName(s: TableState): string {
  if (s.street === 'preflop') return s.raises === 0 ? 'Open' : `${s.raises + 2}-Bet`;
  if (s.raises === 0) return s.street === 'flop' && s.toAct !== null && s.toAct === s.pfAggressor ? 'C-bet' : 'Bet';
  return s.raises === 1 ? 'Raise' : `${s.raises + 1}-Bet`;
}

export function callName(s: TableState): string {
  return s.street === 'preflop' && s.raises === 0 ? 'Limp' : 'Call';
}

/** Tags the app can work out by itself. */
export function autoTags(hand: Hand, r: Replay): string[] {
  const tags: string[] = [];
  let maxPf = 0;
  let sawFlop = 0;
  let allIn = false;
  for (const st of r.steps) {
    if ((st.actStreet ?? st.street) === 'preflop') maxPf = Math.max(maxPf, st.state.raises);
    if (st.kind === 'board' && st.street === 'flop') sawFlop = st.state.folded.filter((f) => !f).length;
    if (st.state.last?.allIn) allIn = true;
  }
  if (maxPf >= 3) tags.push('4-bet pot');
  else if (maxPf === 2) tags.push('3-bet pot');
  else if (maxPf === 0 && r.final.street !== 'preflop') tags.push('Limped');
  if (sawFlop >= 3) tags.push('Multiway');
  if (allIn) tags.push('All-in');
  if (r.result && !r.final.foldWin) tags.push('Showdown');
  if (r.result) {
    const bb = hand.game.bb || 1;
    const pot = r.result.pots.reduce((a, p) => a + p.amount, 0);
    if (pot >= 40 * bb) tags.push('Pote grande');
  }
  return tags;
}

/** Cards already used in the hand, to grey them out in pickers. */
export function usedCards(hand: Hand, except: string[] = []): Set<string> {
  const set = new Set<string>();
  for (const p of hand.players) for (const c of p.cards ?? []) set.add(c);
  for (const c of hand.board) set.add(c);
  for (const c of except) set.delete(c);
  return set;
}

export function totalPot(s: TableState): number {
  return s.pot + s.bets.reduce((a, b) => a + b, 0);
}

/** False while the hand still waits for an action, a board card or hero's cards. */
export function isComplete(hand: Hand, r: Replay = replay(hand)): boolean {
  const s = r.final;
  return (hand.players[hand.hero].cards?.length ?? 0) === 2 && !s.needsBoard && s.toAct === null && (!r.result || r.result.resolved);
}
