import { bestHand, categoryLabel, type HandValue } from './evaluate';
import type { Action, ActionType, Card, HandRecord, Locale, Player, Street } from './types';
import { STREETS } from './types';

export interface SeatState {
  seat: number;
  name: string;
  position: string;
  stack: number;
  /** Chips in front of the player on the current street. */
  committed: number;
  /** Live chips put in during the hand (antes excluded: they are dead money). */
  invested: number;
  folded: boolean;
  allIn: boolean;
  cards: Card[] | null;
  /** Cards are visible to the viewer at this step. */
  showCards: boolean;
  isHero: boolean;
  isButton: boolean;
  lastAction?: { type: ActionType; amount?: number };
  /** Amount won at the final step. */
  won?: number;
  handLabel?: string;
}

export type StepKind = 'start' | 'street' | 'action' | 'showdown' | 'end';

export interface ReplayStep {
  index: number;
  kind: StepKind;
  street: Street;
  board: Card[];
  /** Chips already gathered in the middle (previous streets + antes). */
  pot: number;
  /** Pot plus everything committed on the current street. */
  totalPot: number;
  seats: SeatState[];
  actingSeat?: number;
  /** `index` is the action's position in `hand.actions[street]`. */
  action?: Action & { paid: number; toAmount: number; index: number };
  /** Amount the acting player had to call before acting (decision spots). */
  facing?: number;
  winners?: { seat: number; amount: number; handLabel?: string }[];
  /**
   * Run it twice (showdown step only): each run's full board and what it paid.
   * `winners` above holds the totals.
   */
  runs?: { board: Card[]; winners: { seat: number; amount: number; handLabel?: string }[] }[];
}

// Same labels as the app (src/poker/engine.ts positions()).
const POSITIONS: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
  10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO'],
};

/** Seats ordered clockwise starting at the button. */
export function seatsFromButton(hand: HandRecord): number[] {
  const seats = hand.players.map((p) => p.seat).sort((a, b) => a - b);
  const start = seats.findIndex((s) => s >= hand.buttonSeat);
  const i = start === -1 ? 0 : start;
  return [...seats.slice(i), ...seats.slice(0, i)];
}

export function positionsFor(hand: HandRecord): Map<number, string> {
  const order = seatsFromButton(hand);
  const names = POSITIONS[order.length] ?? order.map((_, i) => (i === 0 ? 'BTN' : `P${i}`));
  return new Map(order.map((seat, i) => [seat, names[i]]));
}

/** Blind/ante posts implied by the blinds when the record does not list them. */
export function impliedPosts(hand: HandRecord): Action[] {
  const order = seatsFromButton(hand);
  const headsUp = order.length === 2;
  const sbSeat = headsUp ? order[0] : order[1];
  const bbSeat = headsUp ? order[1] : order[2];
  const posts: Action[] = [];
  const { sb, bb, ante, bbAnte } = hand.blinds;
  if (ante) {
    if (bbAnte) posts.push({ seat: bbSeat, type: 'post_ante', amount: ante });
    else for (const seat of order) posts.push({ seat, type: 'post_ante', amount: ante });
  }
  if (sb) posts.push({ seat: sbSeat, type: 'post_sb', amount: sb });
  posts.push({ seat: bbSeat, type: 'post_bb', amount: bb });
  return posts;
}

const isPost = (t: ActionType) => t.startsWith('post_');

function cloneSeats(seats: SeatState[]): SeatState[] {
  return seats.map((s) => ({ ...s, lastAction: s.lastAction ? { ...s.lastAction } : undefined }));
}

export interface BuildOptions {
  /** Reveal every known hole card from the start (owner view). Default: hero only until showdown. */
  revealAll?: boolean;
  locale?: Locale;
}

export function buildReplay(hand: HandRecord, opts: BuildOptions = {}): ReplayStep[] {
  const positions = positionsFor(hand);
  const byButton = seatsFromButton(hand);
  const playerBySeat = new Map<number, Player>(hand.players.map((p) => [p.seat, p]));

  let seats: SeatState[] = byButton.map((seat) => {
    const p = playerBySeat.get(seat)!;
    const cards = p.cards && p.cards.length ? p.cards : null;
    return {
      seat,
      name: p.name || positions.get(seat) || `Seat ${seat}`,
      position: positions.get(seat) ?? '',
      stack: p.stack,
      committed: 0,
      invested: 0,
      folded: false,
      allIn: false,
      cards,
      showCards: !!cards && (!!p.isHero || !!opts.revealAll),
      isHero: !!p.isHero,
      isButton: seat === hand.buttonSeat,
    };
  });

  let pot = 0;
  let board: Card[] = [];
  const steps: ReplayStep[] = [];
  const committedTotal = () => seats.reduce((n, s) => n + s.committed, 0);

  const push = (kind: StepKind, street: Street, extra: Partial<ReplayStep> = {}) => {
    steps.push({
      index: steps.length,
      kind,
      street,
      board: board.slice(),
      pot,
      totalPot: pot + committedTotal(),
      seats: cloneSeats(seats),
      ...extra,
    });
  };

  const seatState = (seat: number) => {
    const s = seats.find((x) => x.seat === seat);
    if (!s) throw new Error(`Action for unknown seat ${seat}`);
    return s;
  };

  const pay = (s: SeatState, amount: number, dead = false) => {
    const paid = Math.max(0, Math.min(amount, s.stack));
    s.stack -= paid;
    if (dead) pot += paid;
    else {
      s.committed += paid;
      s.invested += paid;
    }
    if (s.stack === 0 && paid > 0) s.allIn = true;
    return paid;
  };

  const returnUncalled = () => {
    const sorted = seats.slice().sort((a, b) => b.committed - a.committed);
    if (sorted.length < 2) return;
    const [top, second] = sorted;
    const excess = top.committed - second.committed;
    if (excess > 0) {
      top.committed -= excess;
      top.invested -= excess;
      top.stack += excess;
      if (top.stack > 0) top.allIn = false;
    }
  };

  const collect = () => {
    returnUncalled();
    pot += committedTotal();
    for (const s of seats) {
      s.committed = 0;
      s.lastAction = undefined;
    }
  };

  const applyAction = (a: Action) => {
    const s = seatState(a.seat);
    const maxCommitted = Math.max(...seats.map((x) => x.committed));
    const facing = Math.max(0, maxCommitted - s.committed);
    let paid = 0;
    switch (a.type) {
      case 'post_ante':
        paid = pay(s, a.amount ?? hand.blinds.ante ?? 0, true);
        break;
      case 'post_sb':
        paid = pay(s, a.amount ?? hand.blinds.sb);
        break;
      case 'post_bb':
        paid = pay(s, a.amount ?? hand.blinds.bb);
        break;
      case 'post_straddle':
        paid = pay(s, a.amount ?? hand.blinds.bb * 2);
        break;
      case 'fold':
        s.folded = true;
        break;
      case 'check':
        break;
      case 'call':
        paid = pay(s, facing);
        break;
      case 'bet':
      case 'raise':
        paid = pay(s, (a.amount ?? maxCommitted) - s.committed);
        break;
      case 'allin':
        paid = pay(s, s.stack);
        s.allIn = true;
        break;
    }
    const shown = a.type === 'fold' || a.type === 'check' ? undefined : a.type === 'call' || isPost(a.type) ? paid : s.committed;
    s.lastAction = { type: a.type, amount: shown };
    return { paid, facing, toAmount: s.committed };
  };

  // Preflop: posts are folded into the start step.
  const preflop = hand.actions.preflop ?? [];
  const hasPosts = preflop.some((a) => isPost(a.type));
  const posts = hasPosts ? preflop.filter((a) => isPost(a.type)) : impliedPosts(hand);
  const indexed = (list: Action[]) => list.map((a, index) => ({ a, index }));
  const rest = indexed(preflop).filter(({ a }) => !isPost(a.type));
  for (const p of posts) applyAction(p);
  push('start', 'preflop');

  const live = () => seats.filter((s) => !s.folded);
  const canAct = () => live().filter((s) => !s.allIn);

  const runStreet = (street: Street, actions: { a: Action; index: number }[]) => {
    for (const { a, index } of actions) {
      if (live().length < 2) break;
      const { paid, facing, toAmount } = applyAction(a);
      push('action', street, { actingSeat: a.seat, action: { ...a, paid, toAmount, index }, facing });
    }
  };

  runStreet('preflop', rest);
  // Board cards out when betting closed with two or more players still in (an all-in).
  let runoutFrom: number | null = null;
  const markRunout = () => {
    if (runoutFrom === null && live().length >= 2 && canAct().length < 2) runoutFrom = board.length;
  };
  markRunout();

  for (const street of STREETS.slice(1) as Street[]) {
    if (live().length < 2) break;
    const cards =
      street === 'flop' ? hand.board?.flop : street === 'turn' ? hand.board?.turn && [hand.board.turn] : hand.board?.river && [hand.board.river];
    if (!cards || cards.length === 0) break;
    collect();
    board = [...board, ...cards];
    // Everyone all-in: reveal cards on the runout, like a TV broadcast.
    if (canAct().length < 2) for (const s of live()) if (s.cards) s.showCards = true;
    push('street', street);
    runStreet(street, indexed(hand.actions[street] ?? []));
    markRunout();
  }

  // Resolution
  const lastStreet = steps[steps.length - 1].street;
  collect();
  const contenders = live();

  if (contenders.length === 1) {
    const w = contenders[0];
    const amount = hand.winners?.find((x) => x.seat === w.seat)?.amount ?? pot;
    w.stack += amount;
    w.won = amount;
    push('end', lastStreet, { winners: [{ seat: w.seat, amount }] });
    return steps;
  }

  for (const s of contenders) if (s.cards) s.showCards = true;
  const second = secondBoard(hand, board, runoutFrom);
  const evaluateOn = (b: Card[], manual: number[] | undefined, label: boolean) => {
    const values = new Map<number, HandValue | null>();
    const labels = new Map<number, string>();
    for (const s of contenders) {
      const v = s.cards ? bestHand(s.cards, b, hand.game) : null;
      values.set(s.seat, v);
      if (v) labels.set(s.seat, categoryLabel(v.category, opts.locale));
      if (v && label) s.handLabel = labels.get(s.seat);
    }
    // Manually picked winners outrank any evaluated hand.
    if (manual?.length)
      for (const s of contenders) if (manual.includes(s.seat)) values.set(s.seat, { score: Number.MAX_SAFE_INTEGER, category: 'high_card', cards: [] });
    return { values, labels };
  };
  const first = evaluateOn(board, hand.winnerSeats, true);

  let winners: { seat: number; amount: number; handLabel?: string }[];
  let runs: ReplayStep['runs'];
  if (hand.winners?.length) {
    winners = hand.winners.map((w) => ({ ...w, handLabel: seatState(w.seat).handLabel }));
  } else if (second) {
    const two = evaluateOn(second, hand.winnerSeats2, false);
    const halves = awardRuns(seats, [first.values, two.values], pot, hand.format === 'cash');
    const named = (list: { seat: number; amount: number }[], labels: Map<number, string>) =>
      list.map((w) => ({ ...w, handLabel: labels.get(w.seat) }));
    runs = [
      { board: board.slice(), winners: named(halves[0], first.labels) },
      { board: second, winners: named(halves[1], two.labels) },
    ];
    const total = new Map<number, number>();
    for (const run of halves) for (const w of run) total.set(w.seat, (total.get(w.seat) ?? 0) + w.amount);
    winners = [...total].map(([seat, amount]) => ({ seat, amount, handLabel: seatState(seat).handLabel }));
  } else {
    winners = awardPots(seats, first.values, pot, hand.format === 'cash');
  }
  for (const w of winners) {
    const s = seatState(w.seat);
    s.stack += w.amount;
    s.won = (s.won ?? 0) + w.amount;
  }
  push('showdown', lastStreet, { winners, ...(runs ? { runs } : {}) });
  return steps;
}

/**
 * Run it twice: the second run's full board (the cards both runs share, then `board2`),
 * or null when the hand wasn't run twice. Only an all-in before the river counts.
 */
export function secondBoard(hand: HandRecord, board: Card[], runoutFrom: number | null): Card[] | null {
  const extra = hand.board2 ?? [];
  if (runoutFrom === null || runoutFrom >= 5 || board.length !== 5 || extra.length < 5 - runoutFrom) return null;
  return [...board.slice(0, runoutFrom), ...extra.slice(0, 5 - runoutFrom)];
}

/** `amount` split k ways, odd chips to the first: to the cent in cash (€1 → 0.50 + 0.50), whole chips in tournaments unless it has decimals. */
function splitChips(amount: number, k: number, cents = false): number[] {
  const unit = cents || !Number.isInteger(amount) ? 100 : 1;
  const total = Math.round(amount * unit);
  const share = Math.floor(total / k);
  return Array.from({ length: k }, (_, i) => (share + (i < total - share * k ? 1 : 0)) / unit);
}

/** Splits the pot into main/side pots by investment and awards each to the best eligible hand. */
export function awardPots(seats: SeatState[], values: Map<number, HandValue | null>, totalPot: number, cents = false) {
  return awardRuns(seats, [values], totalPot, cents)[0];
}

/**
 * Same, once per run: each pot is split evenly between the runs (the odd chip goes with
 * the first, like the app) and each run's share goes to the best hand on that run's board.
 */
export function awardRuns(seats: SeatState[], runs: Map<number, HandValue | null>[], totalPot: number, cents = false) {
  const levels = [...new Set(seats.map((s) => s.invested).filter((v) => v > 0))].sort((a, b) => a - b);
  // Only dead money in the pot (a bomb pot checked down): one pot for everyone still in.
  if (!levels.length) levels.push(0);
  const won = runs.map(() => new Map<number, number>());
  // Antes are dead money and belong to the main pot.
  let dead = totalPot - seats.reduce((n, s) => n + s.invested, 0);
  let prev = 0;
  for (const level of levels) {
    const amount = dead + seats.reduce((n, s) => n + Math.max(0, Math.min(s.invested, level) - prev), 0);
    dead = 0;
    const eligible = seats.filter((s) => !s.folded && s.invested >= level);
    prev = level;
    if (!amount || !eligible.length) continue;
    const parts = splitChips(amount, runs.length);
    runs.forEach((values, k) => {
      const runAmount = parts[k];
      const scored = eligible.map((s) => ({ seat: s.seat, score: values.get(s.seat)?.score ?? -1 }));
      const top = Math.max(...scored.map((x) => x.score));
      let best = scored.filter((x) => x.score === top);
      // Picked winners (no cards) name who won something, not which pot: one all-in for exactly
      // this level can only have won here, so it takes this pot; a deeper picked winner won a side pot.
      if (top === Number.MAX_SAFE_INTEGER && best.length > 1) {
        const last = best.filter((b) => eligible.find((e) => e.seat === b.seat)!.invested === level);
        if (last.length) best = last;
      }
      const shares = splitChips(runAmount, best.length, cents);
      best.forEach((b, i) => won[k].set(b.seat, (won[k].get(b.seat) ?? 0) + shares[i]));
    });
  }
  return won.map((m) =>
    [...m.entries()].map(([seat, amount]) => ({
      seat,
      amount,
      handLabel: seats.find((s) => s.seat === seat)?.handLabel,
    })),
  );
}
