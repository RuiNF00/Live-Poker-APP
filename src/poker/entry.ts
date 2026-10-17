// Entry shortcuts: the logic that makes hand entry a few taps. Pure helpers so
// they can be tested without the UI.

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
    const t = Math.min(l.maxTo, Math.max(l.minTo, to));
    if (t >= l.maxTo) return;
    if (!out.some((o) => o.to === t)) out.push({ label, to: t });
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
    for (const [label, f] of [['25%', 0.25], ['33%', 0.33], ['50%', 0.5], ['75%', 0.75], ['Pote', 1], ['150%', 1.5]] as const)
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
    if (!next) break;
    acts.push(a);
    st = next;
    if (next.street !== s.street) break;
  }
  return acts;
}
