// Entry shortcuts: the logic that makes hand entry a few taps. Pure helpers so
// they can be tested without the UI.

import { t } from '../i18n';

import { apply, legal, totalPot, type TableState } from './engine';
import type { Hand, HandAction } from './types';

export interface SizePreset {
  label: string;
  to: number;
  allIn?: boolean;
}

function roundTo(v: number, unit: number) {
  return Math.max(unit, Math.round(v / unit) * unit);
}

/** One-tap bet/raise sizes for the player to act. */
export function sizePresets(hand: Hand, s: TableState): SizePreset[] {
  const l = legal(s);
  if (!l || (!l.canBet && !l.canRaise)) return [];
  const bb = hand.game.bb;
  const unit = Math.max(1, Math.round(bb / 4));
  const out: SizePreset[] = [];
  const add = (label: string, to: number) => {
    const v = Math.min(l.maxTo, Math.max(l.minTo, to));
    if (v >= l.maxTo) return;
    if (!out.some((o) => o.to === v)) out.push({ label, to: v });
  };
  if (s.street === 'preflop') {
    const unopened = s.currentBet <= bb;
    if (unopened) {
      const limpers = s.bets.filter((b, i) => b === bb && !s.folded[i]).length - 1;
      for (const x of [2, 2.2, 2.5, 3]) add(`${x}x`, Math.round(x * bb + Math.max(0, limpers) * bb));
    } else {
      for (const x of [2.5, 3, 3.5, 4]) add(`${x}x`, roundTo(x * s.currentBet, unit));
    }
  } else if (s.currentBet === 0) {
    const pot = totalPot(s);
    for (const [label, f] of [['25%', 0.25], ['33%', 0.33], ['50%', 0.5], ['75%', 0.75], [t('Pote'), 1], ['150%', 1.5]] as const)
      add(label, roundTo(pot * f, unit));
  } else {
    for (const x of [2.5, 3, 4]) add(`${x}x`, roundTo(x * s.currentBet, unit));
  }
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
 * again after each opponent who opens, limps, calls or raises. Most live hands
 * are entered this way; whoever else came in is one tap away (entrantSeats).
 * Returns [] when it does not apply (hero acted, already hero's turn, or the
 * user is folding seats by hand).
 */
export function autoFold(hand: Hand, s: TableState): HandAction[] {
  if (s.street !== 'preflop' || s.toAct === null || s.toAct === hand.hero || s.folded[hand.hero]) return [];
  if (hand.actions.some((a) => a.p === hand.hero)) return [];
  const last = hand.actions[hand.actions.length - 1];
  if (last && last.kind === 'fold') return [];
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
