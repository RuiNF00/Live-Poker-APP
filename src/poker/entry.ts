// Entry shortcuts: the logic that makes hand entry a few taps. Pure helpers so
// they can be tested without the UI.

import { t } from '../i18n';

import { apply, legal, totalPot, type TableState } from './engine';
import { decimal } from './format';
import type { Hand, HandAction } from './types';

export interface SizePreset {
  label: string;
  to: number;
  allIn?: boolean;
  /** The size this player picked last time in the same spot. */
  last?: boolean;
}

/** The spots a size is remembered for: open, 3-bet+, postflop bet, postflop raise. */
export type SizeSpot = 'open' | 'reraise' | 'bet' | 'raise';
/** Last size per spot, as a multiple of its base (bb, the bet faced, or the pot). */
export type SizeMemory = Partial<Record<SizeSpot, number>>;

function roundTo(v: number, unit: number) {
  return Math.max(unit, Math.round(v / unit) * unit);
}

/**
 * What a size in this spot is measured against: `to = extra + mult * base`.
 * Preflop opens count in bb plus one bb per limper; raises in multiples of the
 * bet faced; postflop bets in fractions of the pot.
 */
export function sizeSpot(hand: Hand, s: TableState): { spot: SizeSpot; base: number; extra: number } {
  const bb = hand.game.bb;
  if (s.street === 'preflop') {
    if (s.currentBet <= bb) {
      const limpers = Math.max(0, s.bets.filter((b, i) => b === bb && !s.folded[i]).length - 1);
      return { spot: 'open', base: bb, extra: limpers * bb };
    }
    return { spot: 'reraise', base: s.currentBet, extra: 0 };
  }
  if (s.currentBet === 0) return { spot: 'bet', base: Math.max(1, totalPot(s)), extra: 0 };
  return { spot: 'raise', base: s.currentBet, extra: 0 };
}

/** The multiple to remember after hero bets or raises `to` here. */
export function sizeToRemember(hand: Hand, s: TableState, to: number): { spot: SizeSpot; mult: number } | null {
  const l = legal(s);
  // Only hero's own sizes; an all-in says nothing about the usual size.
  if (!l || s.toAct !== hand.hero || to >= l.maxTo) return null;
  const { spot, base, extra } = sizeSpot(hand, s);
  const mult = Math.round(((to - extra) / base) * 100) / 100;
  return mult > 0 ? { spot, mult } : null;
}

const FRACTIONS: [number, string][] = [[1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']];

function sizeLabel(spot: SizeSpot, m: number) {
  if (spot !== 'bet') return `${decimal(Math.round(m * 10) / 10).replace(/[.,]0$/, '')}x`;
  const f = FRACTIONS.find(([v]) => Math.abs(v - m) < 0.02);
  if (f) return f[1];
  if (Math.abs(m - 1) < 0.02) return t('Pote');
  return `${Math.round(m * 100)}%`;
}

/** Default sizes per spot. Live cash opens bigger than tournaments do. */
function defaults(hand: Hand, spot: SizeSpot): number[] {
  if (spot === 'open') return hand.game.kind === 'cash' ? [3, 4, 5] : [2, 2.5, 3];
  if (spot === 'bet') return [1 / 3, 1 / 2, 2 / 3, 1];
  return [2.5, 3, 4];
}

/**
 * One-tap bet/raise sizes for the player to act. The size the player used last
 * time in the same spot is always one of them (it takes the place of the
 * nearest default), so a player who opens 2.2x never opens the keypad again.
 */
export function sizePresets(hand: Hand, s: TableState, memory?: SizeMemory): SizePreset[] {
  const l = legal(s);
  if (!l || (!l.canBet && !l.canRaise)) return [];
  const unit = Math.max(1, Math.round(hand.game.bb / 4));
  const { spot, base, extra } = sizeSpot(hand, s);
  const mults = defaults(hand, spot);
  const remembered = memory?.[spot];
  let lastAt = -1;
  if (typeof remembered === 'number' && Number.isFinite(remembered) && remembered > 0) {
    let near = 0;
    mults.forEach((m, i) => {
      if (Math.abs(m - remembered) < Math.abs(mults[near] - remembered)) near = i;
    });
    if (Math.abs(mults[near] - remembered) > 0.04) mults[near] = remembered;
    mults.sort((a, b) => a - b);
    lastAt = mults.findIndex((m) => Math.abs(m - remembered) <= 0.04);
  }
  const out: SizePreset[] = [];
  mults.forEach((m, i) => {
    const raw = extra + m * base;
    // Preflop opens stay exact (2.2x is 2.2 bb); the rest round to a quarter bb.
    const to = Math.min(l.maxTo, Math.max(l.minTo, spot === 'open' ? Math.round(raw) : roundTo(raw, unit)));
    if (to >= l.maxTo) return;
    const same = out.find((o) => o.to === to);
    if (same) {
      if (i === lastAt) Object.assign(same, { label: sizeLabel(spot, m), last: true });
      return;
    }
    out.push({ label: sizeLabel(spot, m), to, ...(i === lastAt ? { last: true } : {}) });
  });
  out.push({ label: 'All-in', to: l.maxTo, allIn: true });
  return out;
}

/**
 * Players the user can jump to. Everyone skipped checks (or folds when facing a
 * bet). The list stops at hero while hero is still in the hand, so a jump
 * never folds hero by accident.
 */
export function skipTargets(hand: Hand, s: TableState): number[] {
  if (s.toAct === null) return [];
  const n = hand.players.length;
  const out: number[] = [];
  for (let k = 1; k < n; k++) {
    const i = (s.toAct + k) % n;
    if (s.folded[i] || s.allIn[i]) continue;
    out.push(i);
    if (i === hand.hero) break;
  }
  if (s.toAct === hand.hero) return [];
  return out;
}

/** Actions that move the turn from the current actor to `target`. */
export function skipTo(hand: Hand, s: TableState, target: number): HandAction[] {
  const acts: HandAction[] = [];
  let st: TableState | null = s;
  for (let guard = 0; st && st.toAct !== null && st.toAct !== target && guard < 20; guard++) {
    const l = legal(st)!;
    const a: HandAction = { p: st.toAct, kind: l.canCheck ? 'check' : 'fold' };
    const next: TableState | null = apply(st, a, hand);
    // Never end the hand on the user's behalf (hero in the BB: the SB decides).
    if (!next || (next.toAct === null && !next.needsBoard)) break;
    acts.push(a);
    st = next;
    if (next.street !== s.street) break;
  }
  return acts;
}

/**
 * Hero is in the pot and done for now: hero bet, raised or called, and the
 * players still to act can only call or fold (unless one raises, entered by
 * hand). Covers hero's open, 3-bet, call, shove and postflop bets.
 */
function heroWaits(hand: Hand, s: TableState): boolean {
  const h = hand.hero;
  return s.toAct !== null && s.toAct !== h && !s.folded[h] && s.currentBet > 0 && s.acted[h] && (s.bets[h] === s.currentBet || s.allIn[h]);
}

/**
 * "Only X calls" (or nobody does) in one tap, once hero has bet, raised or
 * called. Every other player still to act folds, `target` calls; null means
 * everyone folds. Returns [] when the shortcut does not apply.
 */
export function onlyCaller(hand: Hand, s: TableState, target: number | null): HandAction[] {
  if (!heroWaits(hand, s)) return [];
  const acts: HandAction[] = [];
  let st: TableState | null = s;
  for (let guard = 0; st && st.toAct !== null && st.toAct !== hand.hero && guard < 20; guard++) {
    const a: HandAction = { p: st.toAct, kind: st.toAct === target ? 'call' : 'fold' };
    const next: TableState | null = apply(st, a, hand);
    if (!next) break;
    acts.push(a);
    st = next;
    if (next.street !== s.street) break;
  }
  return acts;
}

/** Opponents who could be "the only caller" right now. */
export function callerCandidates(hand: Hand, s: TableState): number[] {
  if (!heroWaits(hand, s)) return [];
  return hand.players.map((_, i) => i).filter((i) => i !== hand.hero && !s.folded[i] && !s.allIn[i] && s.bets[i] < s.currentBet);
}

/**
 * Preflop, before hero's first decision, the players between the last one who
 * did something and hero fold by themselves: at the start of the hand, and
 * again after each opponent who opens, limps, calls or raises. After hero has
 * acted, the same happens when an opponent raises over hero (3-bet, 4-bet). Most live hands
 * are entered this way; whoever else came in is one tap away (entrantSeats).
 * Returns [] when it does not apply (hero acted, already hero's turn, or the
 * user is folding seats by hand).
 */
export function autoFold(hand: Hand, s: TableState): HandAction[] {
  if (s.street !== 'preflop' || s.toAct === null || s.toAct === hand.hero || s.folded[hand.hero]) return [];
  const last = hand.actions[hand.actions.length - 1];
  if (last && last.kind === 'fold') return [];
  // After hero's first decision, only an opponent's raise over hero folds the
  // seats between them by themselves (hero opens, gets 3-bet: the rest fold).
  if (hand.actions.some((a) => a.p === hand.hero) && !(last && last.kind === 'raise' && last.p !== hand.hero)) return [];
  return skipTo(hand, s, hand.hero);
}

/**
 * Seats folded by the last autoFold (actions from..to), offered as "who came
 * in?". Tapping one rewinds to that seat's turn: the seats before it keep
 * their fold, and after its action the rest fold to hero again.
 */
export function rewindTo(hand: Hand, from: number, seat: number): HandAction[] | null {
  for (let k = from; k < hand.actions.length; k++) {
    const a = hand.actions[k];
    if (a.kind !== 'fold') return null;
    if (a.p === seat) return hand.actions.slice(0, k);
  }
  return null;
}

/**
 * Everyone still to act checks: the street checks through in one tap. Only
 * while nobody has bet, so it never folds anyone.
 */
export function checkAround(hand: Hand, s: TableState): HandAction[] {
  const acts: HandAction[] = [];
  let st: TableState | null = s;
  for (let guard = 0; st && st.toAct !== null && guard < 20; guard++) {
    if (!legal(st)!.canCheck) return [];
    const a: HandAction = { p: st.toAct, kind: 'check' };
    const next: TableState | null = apply(st, a, hand);
    if (!next) return [];
    acts.push(a);
    st = next;
    if (next.street !== s.street || next.toAct === null) break;
  }
  return acts.length > 1 ? acts : [];
}
