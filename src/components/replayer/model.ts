// What the replayer shows at each step, worked out from the engine. Pure, testable.

import { t } from '@/i18n';
import { positions, totalPot, type HandResult, type Replay, type Step } from '@/poker/engine';
import { equity } from '@/poker/equity';
import { evaluate } from '@/poker/evaluator';
import { amount, decimal } from '@/poker/format';
import { equityVsRange, rangePctForRaises, topRange } from '@/poker/ranges';
import type { ActionKind, CardCode, Hand, Street } from '@/poker/types';

export type BadgeKind = ActionKind | 'allin';

export interface RpSeat {
  /** Index into hand.players. */
  i: number;
  name: string;
  pos: string;
  stack: string;
  /** Face-up cards, `null` = face down, `undefined` = no cards (folded). */
  cards?: CardCode[] | null;
  folded: boolean;
  allIn: boolean;
  hero: boolean;
  acting: boolean;
  /** This player's latest action on the current street. */
  badge: { kind: BadgeKind; label: string } | null;
  /** Chips in front of the player (this street), raw. */
  bet: number;
  betLabel: string | null;
  /** Won at the end of the hand, formatted, e.g. "+12,5 bb". */
  won: string | null;
  handName: string | null;
  /** Run it twice: the one run this player won (1 or 2), when they didn't win both. */
  run: 1 | 2 | null;
  /** Share of the pot if the board ran out now, 0..1, when every live hand is face up. */
  equity: number | null;
}

export interface RpFacing {
  /** Who hero is up against. */
  vs: string;
  toCall: string;
  potOdds: number;
  mdf: number;
  /** Villain's bet against the pot before it, and the value:bluff ratio a balanced range of that size has. */
  betPct: number;
  vb: number;
  /** Raw numbers for the ICM panel: chips to call, everything in the middle, villain, chips behind and in front of each seat. */
  call: number;
  potAll: number;
  villain: number | null;
  stacks: number[];
  bets: number[];
}

export interface RpHeroBet {
  /** Size against the pot before the bet. */
  pct: number;
  /** Fold equity a pure bluff needs. */
  bluffBE: number;
  /** Value:bluff ratio that makes the next player indifferent. */
  vb: number;
  /** The next player to act, and their pot odds and MDF against the effective bet. */
  vs: string;
  vsPotOdds: number;
  vsMdf: number;
}

export interface RpView {
  seats: RpSeat[];
  board: CardCode[];
  /** Run it twice, at the end: the second run's full board. */
  board2: CardCode[] | null;
  street: Street;
  pot: number;
  potLabel: string;
  narration: string;
  /** Set when hero is the one to act facing a bet. */
  facing: RpFacing | null;
  /** Hero just bet or raised: what a bluff needs, the size, and the price the next player gets. */
  heroBet: RpHeroBet | null;
  /** Hero to act with no bet to face: "Abrir ou foldar", "Pote com limps", "Passar ou apostar". */
  decision: string | null;
  /** Pot / effective stack summary line. */
  info: string;
  /** Heads-up with villain's cards unknown: hero's equity against a range read from villain's preflop raises. */
  rangeEq: { equity: number; pct: number } | null;
  end: boolean;
}

export const STREET_LABEL: Record<Street, string> = { preflop: t('Pré-flop'), flop: 'Flop', turn: 'Turn', river: 'River' };

const RANK_WORD: Record<string, string> = { A: 'Ás', K: 'Rei', Q: 'Dama', J: 'Valete', T: '10' };
const SUIT_WORD: Record<string, string> = { h: 'copas', d: 'ouros', c: 'paus', s: 'espadas' };

/** A card as a screen reader says it: "Ás de copas", "7 de paus". */
export function spokenCard(c: CardCode): string {
  const r = RANK_WORD[c[0]];
  return t('{rank} de {suit}', { rank: r ? t(r) : c[0], suit: t(SUIT_WORD[c[1]] ?? c[1]) });
}

function badgeLabel(kind: BadgeKind, amt: string): string {
  switch (kind) {
    case 'fold':
      return 'FOLD';
    case 'check':
      return 'CHECK';
    case 'call':
      return `CALL ${amt}`;
    case 'bet':
      return `BET ${amt}`;
    case 'raise':
      return `RAISE ${amt}`;
    case 'allin':
      return `ALL-IN ${amt}`;
  }
}

export function displayName(hand: Hand, i: number, pos: string[]) {
  if (i === hand.hero) return hand.players[i].name || 'Hero';
  return hand.players[i].name || pos[i];
}

const equityCache = new Map<string, number[]>();
function cachedEquity(holes: CardCode[][], board: CardCode[]) {
  const key = holes.map((h) => h.join('')).join('|') + '/' + board.join('');
  let eq = equityCache.get(key);
  if (!eq) {
    if (equityCache.size > 200) equityCache.clear();
    eq = equity(holes, board);
    equityCache.set(key, eq);
  }
  return eq;
}

const rangeCache = new Map<string, number | null>();
function cachedRangeEquity(hero: CardCode[], board: CardCode[], pct: number) {
  const key = `${hero.join('')}/${board.join('')}/${pct}`;
  if (!rangeCache.has(key)) {
    if (rangeCache.size > 200) rangeCache.clear();
    rangeCache.set(key, equityVsRange(hero, topRange(pct), board));
  }
  return rangeCache.get(key)!;
}

/** The view at step `k` of the replay. `reveal` shows every known hand. */
export function viewAt(hand: Hand, r: Replay, k: number, opts: { inBB: boolean; reveal: boolean; atEnd: boolean }): RpView {
  const step: Step = r.steps[k];
  const st = step.state;
  const pos = positions(hand.players.length, hand.button);
  const fmt = (n: number) => amount(n, hand, opts.inBB);
  const isShowdown = step.kind === 'showdown';
  const result = opts.atEnd ? r.result : null;

  // Latest action of each player on the street being shown (badges reset when a card is dealt).
  const badges = new Map<number, { kind: BadgeKind; label: string }>();
  for (let j = 0; j <= k; j++) {
    const s = r.steps[j];
    if (s.kind === 'board') badges.clear();
    if (s.kind !== 'action' || !s.state.last) continue;
    const a = s.state.last;
    const kind: BadgeKind = a.allIn ? 'allin' : a.kind;
    // Postflop bets carry their size against the pot, as on a solver: "BET 60 (75%)".
    const before = totalPot(s.state) - a.added;
    const size = a.kind === 'bet' && s.state.street !== 'preflop' && before > 0 ? ` (${Math.round((a.added / before) * 100)}%)` : '';
    badges.set(a.p, { kind, label: badgeLabel(kind, fmt(a.kind === 'call' ? a.added : a.to)) + size });
  }

  // All-in with nobody left to bet: the hands go face up for the run-out, as on TV.
  const final = r.steps[r.steps.length - 1].state;
  const liveNow = hand.players.map((_, i) => i).filter((i) => !st.folded[i]);
  const runout =
    !final.foldWin && st.toAct === null && liveNow.length >= 2 && liveNow.filter((i) => !st.allIn[i]).length <= 1 && liveNow.some((i) => st.allIn[i]);

  const seats: RpSeat[] = hand.players.map((p, i) => {
    const hero = i === hand.hero;
    const known = p.cards && p.cards.length >= 2 ? p.cards : undefined;
    let cards: RpSeat['cards'];
    if (st.folded[i]) cards = undefined;
    else if (hero) cards = known ?? null;
    else if ((isShowdown || opts.reveal || runout || (result && !st.foldWin)) && known) cards = known;
    else cards = null;
    const won = result?.won[i] ?? 0;
    let stack = st.stacks[i];
    if (result) stack += won;
    return {
      i,
      name: displayName(hand, i, pos),
      pos: pos[i],
      stack: st.allIn[i] && !st.folded[i] && !result ? 'ALL-IN' : fmt(stack),
      cards,
      folded: st.folded[i],
      allIn: st.allIn[i] && !st.folded[i],
      hero,
      acting: !result && st.toAct === i,
      badge: st.folded[i] ? { kind: 'fold', label: 'FOLD' } : (badges.get(i) ?? null),
      bet: result ? 0 : st.bets[i],
      betLabel: !result && st.bets[i] > 0 ? fmt(st.bets[i]) : null,
      won: result && won > 0 ? '+' + fmt(won) : null,
      handName: result && cards ? (result.handNames[i] ?? null) : null,
      run: null,
      equity: null,
    };
  });

  // Equity, like on TV: once every hand still in is face up and cards are still to come.
  const board = hand.board.slice(0, st.boardCount);
  const live = seats.filter((s) => !s.folded);
  if (!result && board.length < 5 && live.length >= 2 && live.every((s) => s.cards && s.cards.length === 2)) {
    const eq = cachedEquity(live.map((s) => s.cards!), board);
    live.forEach((s, j) => (s.equity = eq[j]));
  }

  // Heads-up against hidden cards: equity against the range villain's preflop raises suggest.
  let rangeEq: RpView['rangeEq'] = null;
  const heroSeat = seats[hand.hero];
  const villains = live.filter((s) => !s.hero);
  if (!result && !heroSeat.folded && heroSeat.cards && heroSeat.cards.length === 2 && villains.length === 1 && villains[0].cards === null) {
    // How strong villain's preflop raise was: open = 1, 3-bet = 2, 4-bet = 3 (0 = only called).
    let level = 0;
    let raises = 0;
    for (let j = 1; j <= k; j++) {
      const s = r.steps[j];
      const a = s.state.last;
      if (s.kind !== 'action' || s.street !== 'preflop' || !a || (a.kind !== 'raise' && a.kind !== 'bet')) continue;
      raises++;
      if (a.p === villains[0].i) level = raises;
    }
    const pct = rangePctForRaises(level);
    const e = cachedRangeEquity(heroSeat.cards, board, pct);
    if (e != null) rangeEq = { equity: e, pct };
  }

  const pot = result ? result.pots.reduce((a, b) => a + b.amount, 0) : st.pot;
  const potAll = totalPot(st);

  let narration = '';
  if (step.kind === 'start') narration = t('Blinds e antes');
  else if (step.kind === 'board') narration = STREET_LABEL[step.street];
  else if (isShowdown) narration = 'Showdown';
  else if (st.last) narration = `${displayName(hand, st.last.p, pos)}: ${badgeLabel(st.last.allIn ? 'allin' : st.last.kind, fmt(st.last.kind === 'call' ? st.last.added : st.last.to)).toLowerCase()}`;
  // Run it twice: each board pays half of every pot.
  const board2 = result && r.boards.length === 2 ? r.boards[1] : null;
  if (result && board2) {
    const runs = runPayouts(result, hand.players.length);
    for (const s of seats) if (s.won) s.run = runs[0][s.i] && !runs[1][s.i] ? 1 : runs[1][s.i] && !runs[0][s.i] ? 2 : null;
    narration = runs
      .map((paid, j) => {
        const names = seats
          .filter((s) => paid[s.i] > 0)
          .map((s) => {
            const hn = s.cards ? (j === 0 ? s.handName : evaluate([...s.cards, ...board2]).name) : null;
            return `${s.name} ${t('ganha')} ${fmt(paid[s.i])}${hn ? ` (${hn})` : ''}`;
          });
        return `Board ${j + 1}: ${names.join(', ')}`;
      })
      .join(' · ');
  } else if (result) {
    const winners = seats.filter((s) => s.won);
    if (winners.length) narration = winners.map((s) => `${s.name} ${t('ganha')} ${s.won!.slice(1)}${s.handName ? ` (${s.handName})` : ''}`).join(' · ');
  }

  let facing: RpFacing | null = null;
  if (!result && st.toAct === hand.hero) {
    const toCall = Math.min(Math.max(0, st.currentBet - st.bets[hand.hero]), st.stacks[hand.hero]);
    // Only a bet or raise has a price: blinds, straddles and limps don't (that's an open or iso spot).
    if (toCall > 0 && st.raises > 0 && st.lastAggressor != null) {
      const aggressor = st.lastAggressor;
      const reach = st.bets[hand.hero] + st.stacks[hand.hero];
      const potEff = potAll - Math.max(0, st.currentBet - reach);
      facing = {
        vs: aggressor != null ? displayName(hand, aggressor, pos) : '',
        toCall: fmt(toCall),
        // Against the effective bet: what villain put in beyond what hero can match goes back to them.
        potOdds: toCall / (potEff + toCall),
        mdf: Math.max(0, Math.min(1, (potEff - toCall) / potEff)),
        betPct: toCall / Math.max(1, potEff - toCall),
        vb: potEff / toCall,
        call: toCall,
        potAll,
        villain: aggressor,
        stacks: st.stacks.slice(),
        bets: st.bets.slice(),
      };
    }
  }

  // Hero has just bet or raised and someone still has to answer.
  let heroBet: RpHeroBet | null = null;
  const la = st.last;
  if (!result && step.kind === 'action' && la && la.p === hand.hero && (la.kind === 'bet' || la.kind === 'raise') && st.toAct != null && st.toAct !== hand.hero) {
    const v = st.toAct;
    const vReach = st.bets[v] + st.stacks[v];
    const back = Math.max(0, st.currentBet - vReach);
    const risk = Math.max(0, la.added - back);
    const potV = potAll - back;
    const toCallV = Math.min(st.currentBet - st.bets[v], st.stacks[v]);
    if (risk > 0 && toCallV > 0) {
      heroBet = {
        pct: la.added / Math.max(1, potAll - la.added),
        bluffBE: risk / potV,
        vb: potV / risk,
        vs: displayName(hand, v, pos),
        vsPotOdds: toCallV / (potV + toCallV),
        vsMdf: Math.max(0, Math.min(1, (potV - toCallV) / potV)),
      };
    }
  }

  // Hero to act with no bet to face: say what the decision is instead of a price.
  let decision: string | null = null;
  if (!result && !facing && st.toAct === hand.hero) {
    if (st.street !== 'preflop') decision = t('Passar ou apostar');
    else {
      let limps = 0;
      for (let j = 1; j <= k; j++) if (r.steps[j].state.street === 'preflop' && r.steps[j].state.last?.kind === 'call') limps++;
      decision = limps ? t('Pote com limps') : t('Abrir ou foldar');
    }
  }

  const liveIdx = hand.players.map((_, i) => i).filter((i) => !st.folded[i]);
  const heroBehind = st.stacks[hand.hero];
  const villainMax = Math.max(0, ...liveIdx.filter((i) => i !== hand.hero).map((i) => st.stacks[i] + st.bets[i]));
  const eff = Math.min(heroBehind + st.bets[hand.hero], villainMax);
  const spr = st.pot > 0 && step.street !== 'preflop' ? eff / st.pot : null;
  const info = [
    `${t('Pote')} ${fmt(result ? pot : potAll)}`,
    !st.folded[hand.hero] && !result && eff > 0 ? `${t('Efetivo')} ${fmt(eff)}` : null,
    spr != null && eff > 0 && !result && !st.folded[hand.hero] ? `SPR ${decimal(spr)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    seats,
    board,
    board2,
    street: step.street,
    pot,
    potLabel: fmt(result ? pot : st.pot),
    narration,
    facing,
    heroBet,
    decision,
    info,
    rangeEq,
    end: !!result,
  };
}

/** Run it twice: what each run paid each player, split as the engine splits it. */
export function runPayouts(result: HandResult, n: number): number[][] {
  const out = [new Array(n).fill(0), new Array(n).fill(0)];
  const pay = (run: number, amount: number, winners: number[] | null | undefined) => {
    if (!winners?.length) return;
    const share = Math.floor(amount / winners.length);
    let odd = amount - share * winners.length;
    for (const w of winners) {
      out[run][w] += share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
    }
  };
  for (const pot of result.pots) {
    const first = Math.ceil(pot.amount / 2);
    pay(0, first, pot.winners);
    pay(1, pot.amount - first, pot.winners2);
  }
  return out;
}

export interface TimelineItem {
  k: number;
  kind: 'street' | 'action' | 'end';
  label: string;
  /** Short action code, e.g. "R 2,2bb". */
  detail?: string;
  color: 'hero' | 'aggr' | 'passive' | 'fold' | 'street';
}

/** One entry per step after the blinds: streets as markers, actions as dots. */
export function timeline(hand: Hand, r: Replay, inBB: boolean): TimelineItem[] {
  const pos = positions(hand.players.length, hand.button);
  const items: TimelineItem[] = [{ k: 0, kind: 'street', label: STREET_LABEL.preflop.toUpperCase(), color: 'street' }];
  r.steps.forEach((s, k) => {
    if (s.kind === 'board') items.push({ k, kind: 'street', label: STREET_LABEL[s.street].toUpperCase(), color: 'street' });
    else if (s.kind === 'showdown') items.push({ k, kind: 'end', label: 'SHOWDOWN', color: 'street' });
    else if (s.kind === 'action' && s.state.last) {
      const a = s.state.last;
      // A name that doesn't fit the timeline slot shows the position instead of being cut mid-word.
      const nm = hand.players[a.p].name;
      const who = nm && nm.length <= 7 ? nm : a.p === hand.hero ? 'Hero' : pos[a.p];
      const amt = amount(a.kind === 'call' ? a.added : a.to, hand, inBB).replace(' ', '');
      const code = a.allIn ? `AI ${amt}` : { fold: 'F', check: 'X', call: `C ${amt}`, bet: `B ${amt}`, raise: `R ${amt}` }[a.kind];
      items.push({
        k,
        kind: 'action',
        label: who,
        detail: code,
        color: a.kind === 'fold' ? 'fold' : a.p === hand.hero ? 'hero' : a.kind === 'bet' || a.kind === 'raise' || a.allIn ? 'aggr' : 'passive',
      });
    }
  });
  return items;
}
