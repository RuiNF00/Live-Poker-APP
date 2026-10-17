// What the replayer shows at each step, worked out from the engine. Pure, testable.

import { t } from '@/i18n';
import { positions, totalPot, type Replay, type Step } from '@/poker/engine';
import { amount } from '@/poker/format';
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
}

export interface RpFacing {
  /** Who hero is up against. */
  vs: string;
  toCall: string;
  potOdds: number;
  mdf: number;
}

export interface RpView {
  seats: RpSeat[];
  board: CardCode[];
  street: Street;
  pot: number;
  potLabel: string;
  narration: string;
  /** Set when hero is the one to act facing a bet. */
  facing: RpFacing | null;
  /** Pot / effective stack summary line. */
  info: string;
  end: boolean;
}

export const STREET_LABEL: Record<Street, string> = { preflop: t('Pré-flop'), flop: 'Flop', turn: 'Turn', river: 'River' };

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
    badges.set(a.p, { kind, label: badgeLabel(kind, fmt(a.kind === 'call' ? a.added : a.to)) });
  }

  const seats: RpSeat[] = hand.players.map((p, i) => {
    const hero = i === hand.hero;
    const known = p.cards && p.cards.length >= 2 ? p.cards : undefined;
    let cards: RpSeat['cards'];
    if (st.folded[i]) cards = undefined;
    else if (hero) cards = known ?? null;
    else if ((isShowdown || opts.reveal || (result && !st.foldWin)) && known) cards = known;
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
    };
  });

  const pot = result ? result.pots.reduce((a, b) => a + b.amount, 0) : st.pot;
  const potAll = totalPot(st);

  let narration = '';
  if (step.kind === 'start') narration = t('Blinds e antes');
  else if (step.kind === 'board') narration = STREET_LABEL[step.street];
  else if (isShowdown) narration = 'Showdown';
  else if (st.last) narration = `${displayName(hand, st.last.p, pos)}: ${badgeLabel(st.last.allIn ? 'allin' : st.last.kind, fmt(st.last.kind === 'call' ? st.last.added : st.last.to)).toLowerCase()}`;
  if (result) {
    const winners = seats.filter((s) => s.won);
    if (winners.length) narration = winners.map((s) => `${s.name} ${t('ganha')} ${s.won!.slice(1)}${s.handName ? ` (${s.handName})` : ''}`).join(' · ');
  }

  let facing: RpFacing | null = null;
  if (!result && st.toAct === hand.hero) {
    const toCall = Math.min(Math.max(0, st.currentBet - st.bets[hand.hero]), st.stacks[hand.hero]);
    if (toCall > 0) {
      const aggressor = st.lastAggressor ?? st.last?.p ?? null;
      facing = {
        vs: aggressor != null ? displayName(hand, aggressor, pos) : '',
        toCall: fmt(toCall),
        potOdds: toCall / (potAll + toCall),
        mdf: Math.max(0, Math.min(1, (potAll - toCall) / potAll)),
      };
    }
  }

  const live = hand.players.map((_, i) => i).filter((i) => !st.folded[i]);
  const heroBehind = st.stacks[hand.hero];
  const villainMax = Math.max(0, ...live.filter((i) => i !== hand.hero).map((i) => st.stacks[i] + st.bets[i]));
  const eff = Math.min(heroBehind + st.bets[hand.hero], villainMax);
  const spr = st.pot > 0 && step.street !== 'preflop' ? eff / st.pot : null;
  const info = [
    `${t('Pote')} ${fmt(result ? pot : potAll)}`,
    !st.folded[hand.hero] && !result ? `${t('Efetivo')} ${fmt(eff)}` : null,
    spr != null && !result && !st.folded[hand.hero] ? `SPR ${spr.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    seats,
    board: hand.board.slice(0, st.boardCount),
    street: step.street,
    pot,
    potLabel: fmt(result ? pot : st.pot),
    narration,
    facing,
    info,
    end: !!result,
  };
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
      const who = a.p === hand.hero ? hand.players[a.p].name || 'Hero' : hand.players[a.p].name ? hand.players[a.p].name.slice(0, 6) : pos[a.p];
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
