// "Posso subir de stake?": how many buy-ins the bankroll holds for the stake
// the player plays and the next one up, the risk of ruin from their own win
// rate and spread, and a shot: a few buy-ins set aside for the bigger stake,
// with the point where they go back. Pure, so it can be tested.
//
// Risk of ruin for a player who wins μ an hour with spread σ an hour and has a
// bankroll B: exp(−2·μ·B/σ²). It assumes the same BB/h at the bigger stake,
// which is optimistic: the screen says so.

import { CASH_STAKES } from './rules-math';
import { playedMs, profit } from './session-math';
import type { BankrollRules, Session, ShotPlan } from './types';
import type { WinRate } from './winrate-math';

const DAY = 86400000;
const BUY_IN_BB = 100;

export interface Stake {
  sb: number;
  bb: number;
}

/** The cash stake with the most hours in the last 90 days (else ever); null without cash. */
export function currentStake(sessions: Session[], now = Date.now()): Stake | null {
  const cash = sessions.filter((s) => s.endedAt && s.kind === 'cash' && s.bb > 0);
  const recent = cash.filter((s) => s.startedAt >= now - 90 * DAY);
  const pool = recent.length ? recent : cash;
  const hrs = new Map<string, { s: Stake; h: number }>();
  for (const s of pool) {
    const k = `${s.sb}/${s.bb}`;
    const x = hrs.get(k) ?? { s: { sb: s.sb, bb: s.bb }, h: 0 };
    x.h += playedMs(s) || 1;
    hrs.set(k, x);
  }
  return [...hrs.values()].sort((a, b) => b.h - a.h || b.s.bb - a.s.bb)[0]?.s ?? null;
}

/** The next common stake above this one. */
export function nextStake(s: Stake): Stake | null {
  const n = CASH_STAKES.find(([, bb]) => bb > s.bb);
  return n ? { sb: n[0], bb: n[1] } : null;
}

export const buyIn = (s: Stake) => s.bb * BUY_IN_BB;
export const buyIns = (balance: number, s: Stake) => balance / buyIn(s);

export interface MoveUp {
  cur: Stake;
  next: Stake | null;
  /** Buy-ins the balance holds at each. */
  curBuyIns: number;
  nextBuyIns: number | null;
  /** The rule (buy-ins wanted) and whether the balance meets it for the next stake. */
  rule: number;
  ready: boolean;
  /** What the rule asks for the next stake, and what is missing. */
  need: number | null;
  missing: number;
}

export function moveUp(balance: number, cur: Stake, rules: Pick<BankrollRules, 'cashBuyIns'>): MoveUp {
  const next = nextStake(cur);
  const need = next ? buyIn(next) * rules.cashBuyIns : null;
  return {
    cur,
    next,
    curBuyIns: buyIns(balance, cur),
    nextBuyIns: next ? buyIns(balance, next) : null,
    rule: rules.cashBuyIns,
    ready: need !== null && balance >= need,
    need,
    missing: need !== null ? Math.max(0, need - Math.max(0, balance)) : 0,
  };
}

/** Chance of losing the whole bankroll at a stake, 0–1, from BB/h and its spread. 1 when not winning. */
export function riskOfRuin(balance: number, s: Stake, w: Pick<WinRate, 'bbHourly' | 'sdBb'>): number {
  if (balance <= 0) return 1;
  if (!(w.bbHourly > 0)) return 1;
  if (!(w.sdBb > 0)) return 0;
  const mu = w.bbHourly * s.bb;
  const sd = w.sdBb * s.bb;
  return Math.min(1, Math.exp((-2 * mu * balance) / (sd * sd)));
}

/** Buy-ins of this stake for a given risk of ruin (e.g. 0.05); null when not winning. */
export function buyInsForRisk(risk: number, w: Pick<WinRate, 'bbHourly' | 'sdBb'>): number | null {
  if (!(w.bbHourly > 0) || !(w.sdBb > 0)) return null;
  // B in big blinds = −σ²·ln(risk)/(2μ), all per hour in BB; one buy-in is 100 BB.
  return (-(w.sdBb * w.sdBb) * Math.log(risk)) / (2 * w.bbHourly) / BUY_IN_BB;
}

export interface ShotState {
  plan: ShotPlan;
  /** Net result at the shot stake since the plan started (negative = lost). */
  net: number;
  /** Buy-ins lost so far (0 when ahead). */
  lostBuyIns: number;
  /** Buy-ins still to lose before going back. */
  left: number;
  /** Lost what the plan allows: time to go back down. */
  over: boolean;
  sessions: number;
}

/** Where a shot stands: sessions at its stake since it started, in this bankroll's sessions. */
export function shotState(plan: ShotPlan, sessions: Session[]): ShotState {
  const at = sessions.filter((s) => s.endedAt && s.kind === 'cash' && s.sb === plan.sb && s.bb === plan.bb && s.startedAt >= plan.startedAt);
  const net = at.reduce((a, s) => a + profit(s), 0);
  const lostBuyIns = Math.max(0, -net) / buyIn(plan);
  return { plan, net, lostBuyIns, left: Math.max(0, plan.stopAfter - lostBuyIns), over: lostBuyIns >= plan.stopAfter, sessions: at.length };
}

/** The tournament buy-in the player usually plays: the median entry of the last 90 days (else ever); null without tournaments. */
export function usualMttBuyIn(sessions: Session[], now = Date.now()): number | null {
  const mtt = sessions.filter((s) => s.endedAt && s.kind === 'mtt' && s.buyIn > 0);
  const recent = mtt.filter((s) => s.startedAt >= now - 90 * DAY);
  const b = (recent.length ? recent : mtt).map((s) => s.buyIn).sort((x, y) => x - y);
  return b.length ? b[Math.floor((b.length - 1) / 2)] : null;
}

export interface Keep {
  /** What the player's own rules ask the bankroll to hold for the game they play. */
  need: number;
  /** What can come out and still leave `need` (0 when already at or under it). */
  free: number;
  /** The game that sets `need`: the cash stake, or the usual tournament buy-in. */
  basis: { kind: 'cash'; stake: Stake; buyIns: number } | { kind: 'mtt'; buyIn: number; buyIns: number };
}

/**
 * "Quanto posso levantar?": the balance above what the rules want for the
 * stake the player plays now (cash) and their usual tournament buy-in, the
 * bigger of the two. Null when they've played neither.
 */
export function withdrawable(balance: number, sessions: Session[], r: Pick<BankrollRules, 'cashBuyIns' | 'mttBuyIns'>, now = Date.now()): Keep | null {
  const stake = currentStake(sessions, now);
  const mtt = usualMttBuyIn(sessions, now);
  const cashNeed = stake ? buyIn(stake) * r.cashBuyIns : -1;
  const mttNeed = mtt !== null ? mtt * r.mttBuyIns : -1;
  if (cashNeed < 0 && mttNeed < 0) return null;
  const basis: Keep['basis'] = cashNeed >= mttNeed ? { kind: 'cash', stake: stake!, buyIns: r.cashBuyIns } : { kind: 'mtt', buyIn: mtt!, buyIns: r.mttBuyIns };
  const need = Math.max(cashNeed, mttNeed);
  return { need, free: Math.max(0, Math.floor(balance - need)), basis };
}
