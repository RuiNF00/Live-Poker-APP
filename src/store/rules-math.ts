// Bankroll rules: which stakes the bankroll allows, how close the player is to
// their stop-loss, and how far from their target. Pure, so it can be tested.
//
// A cash buy-in is 100 big blinds; "30 buy-ins" for 2/5 means 30 × 500.

import { cost, ownCost, profit } from './session-math';
import type { BankrollRules, Session } from './types';

export const DEFAULT_RULES: BankrollRules = { cashBuyIns: 30, mttBuyIns: 100, stopLoss: 0, stopLossPer: 'session', target: 0 };

/** Common live cash stakes, smallest first. */
export const CASH_STAKES: readonly [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 5],
  [5, 10],
  [10, 20],
  [10, 25],
  [25, 50],
  [50, 100],
  [100, 200],
  [200, 400],
  [500, 1000],
];

const BUY_IN_BB = 100;

export interface CashStake {
  sb: number;
  bb: number;
  /** Bankroll this stake needs under the rules. */
  need: number;
}

export interface Allowed {
  /** Biggest stake the bankroll allows; null when not even the smallest. */
  cash: CashStake | null;
  /** The next stake up, and what's missing for it. */
  next: (CashStake & { missing: number }) | null;
  /** Biggest tournament buy-in it allows. */
  mttMax: number;
}

const needFor = (bb: number, r: BankrollRules) => bb * BUY_IN_BB * r.cashBuyIns;

export function allowedStakes(balance: number, r: BankrollRules): Allowed {
  const all = CASH_STAKES.map(([sb, bb]) => ({ sb, bb, need: needFor(bb, r) }));
  const ok = all.filter((x) => balance >= x.need);
  const cash = ok[ok.length - 1] ?? null;
  const n = all[ok.length];
  return {
    cash,
    next: n ? { ...n, missing: n.need - Math.max(0, balance) } : null,
    mttMax: r.mttBuyIns > 0 ? Math.max(0, Math.floor(balance / r.mttBuyIns)) : 0,
  };
}

/** Stakes played since `since` that the rules don't allow at today's balance, biggest first. */
export function aboveRules(sessions: Session[], balance: number, r: BankrollRules, since: number): string[] {
  const out = new Map<string, number>();
  for (const s of sessions) {
    if (s.startedAt < since) continue;
    if (s.kind === 'cash' ? s.bb > 0 && balance < needFor(s.bb, r) : r.mttBuyIns > 0 && s.buyIn > balance / r.mttBuyIns) {
      const label = s.kind === 'cash' ? `${s.sb}/${s.bb}` : `MTT ${s.buyIn}`;
      out.set(label, s.kind === 'cash' ? s.bb * BUY_IN_BB : s.buyIn);
    }
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/**
 * Where a live session stands. Cash: the stack against everything put in.
 * A tournament has no money result until it ends, so it is what it cost.
 */
export function liveResult(s: Session): number {
  return s.kind === 'cash' ? s.stack - cost(s) - (s.expenses || 0) - (s.tips || 0) : -ownCost(s);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface StopLoss {
  limit: number;
  per: BankrollRules['stopLossPer'];
  /** Lost so far (0 when ahead). */
  lost: number;
  left: number;
  /** At or past 80%. */
  near: boolean;
  hit: boolean;
}

/**
 * The stop-loss now: for the live session alone, or for every session that
 * started today (the live one included) in this bankroll. `result` lets swap
 * settlements count once the Swaps thread turns them on.
 */
export function stopLoss(
  r: BankrollRules | undefined,
  sessions: Session[],
  live: Session | null,
  now = Date.now(),
  result: (s: Session) => number = profit,
): StopLoss | null {
  if (!r || !(r.stopLoss > 0)) return null;
  let net = 0;
  if (r.stopLossPer === 'session') {
    if (!live) return null;
    net = liveResult(live);
  } else {
    const from = startOfDay(now);
    for (const s of sessions) if (s.endedAt && s.startedAt >= from && s.id !== live?.id) net += result(s);
    if (live) net += liveResult(live);
  }
  const lost = Math.max(0, -net);
  return { limit: r.stopLoss, per: r.stopLossPer, lost, left: Math.max(0, r.stopLoss - lost), near: lost >= 0.8 * r.stopLoss, hit: lost >= r.stopLoss };
}

/** Progress to the target balance, 0–1; null without one. */
export function targetProgress(r: BankrollRules | undefined, balance: number): number | null {
  if (!r || !(r.target > 0)) return null;
  return Math.max(0, Math.min(1, balance / r.target));
}
