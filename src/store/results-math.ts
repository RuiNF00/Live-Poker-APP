// Deeper results: drawdowns on the profit curve, the spread of your results
// (standard deviation) and what that spread means over the next N hours or
// tournaments. Pure, so it can be tested.

import { cost, mainCurrency, playedMs, profit } from './session-math';
import type { Session } from './types';

export interface Drawdown {
  /** Highest point the curve reached. */
  peak: number;
  /** Biggest fall from a peak to a later low. */
  max: number;
  /** How far below the peak the curve is now. */
  current: number;
  /** Running peak at each point, for the chart. */
  peaks: number[];
}

export function drawdown(values: number[]): Drawdown {
  let peak = values.length ? values[0] : 0;
  let max = 0;
  const peaks = values.map((v) => {
    peak = Math.max(peak, v);
    max = Math.max(max, peak - v);
    return peak;
  });
  const last = values[values.length - 1] ?? 0;
  return { peak: values.length ? peak : 0, max, current: values.length ? peak - last : 0, peaks };
}

/** Your own numbers, for the variance calculator. Null until there's enough to say anything. */
export interface CashStats {
  hours: number;
  sessions: number;
  /** Win rate per hour. */
  hourly: number;
  /** Standard deviation per hour. */
  sdHour: number;
}

/**
 * Cash: win rate per hour and its standard deviation per hour. A session of
 * h hours has variance h·σ², so σ² = Σ(resultᵢ − w·hᵢ)² / Σhᵢ.
 */
export function cashStats(list: Session[], currency = mainCurrency(list)): CashStats | null {
  const done = list.filter((s) => s.endedAt && s.kind === 'cash' && s.currency === currency && playedMs(s) > 0);
  if (done.length < 3) return null;
  const hrs = done.map((s) => playedMs(s) / 3600000);
  const res = done.map(profit);
  const hours = hrs.reduce((a, b) => a + b, 0);
  const hourly = res.reduce((a, b) => a + b, 0) / hours;
  const varHour = res.reduce((a, r, i) => a + (r - hourly * hrs[i]) ** 2, 0) / hours;
  return { hours, sessions: done.length, hourly, sdHour: Math.sqrt(varHour) };
}

export interface MttStats {
  tournaments: number;
  /** Average total cost (buy-ins, re-entries, add-ons). */
  avgBuyIn: number;
  /** % on cost. */
  roi: number;
  /** Standard deviation of one tournament's result, in buy-ins. */
  sdBuyIns: number;
}

/** Tournaments: ROI and the spread of one result measured in buy-ins (staking ignored, it's the game's variance). */
export function mttStats(list: Session[], currency = mainCurrency(list)): MttStats | null {
  const done = list.filter((s) => s.endedAt && s.kind === 'mtt' && s.currency === currency && cost(s) > 0);
  if (done.length < 5) return null;
  const bis = done.map((s) => (s.cashOut - cost(s)) / cost(s));
  const mean = bis.reduce((a, b) => a + b, 0) / bis.length;
  const sd = Math.sqrt(bis.reduce((a, b) => a + (b - mean) ** 2, 0) / (bis.length - 1));
  const avgBuyIn = done.reduce((a, s) => a + cost(s), 0) / done.length;
  return { tournaments: done.length, avgBuyIn, roi: mean * 100, sdBuyIns: sd };
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
export function normCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export interface Projection {
  /** Expected result. */
  mean: number;
  sd: number;
  /** 68% of outcomes fall in [lo68, hi68], 95% in [lo95, hi95]. */
  lo68: number;
  hi68: number;
  lo95: number;
  hi95: number;
  /** Chance of ending below zero, 0–1. */
  pLoss: number;
  /** Units needed to be 95% sure of being ahead (null if the win rate isn't positive). */
  unitsFor95: number | null;
}

/** Result after n units (hours or tournaments) at `rate` per unit with `sd` per unit. */
export function project(rate: number, sd: number, n: number): Projection {
  const mean = rate * n;
  const s = Math.abs(sd) * Math.sqrt(Math.max(0, n));
  return {
    mean,
    sd: s,
    lo68: mean - s,
    hi68: mean + s,
    lo95: mean - 1.96 * s,
    hi95: mean + 1.96 * s,
    pLoss: s > 0 ? normCdf(-mean / s) : mean < 0 ? 1 : 0,
    unitsFor95: rate > 0 ? Math.ceil(((1.645 * Math.abs(sd)) / rate) ** 2) : null,
  };
}

/** The last n finished sessions' results, oldest first (for the win/loss dots). */
export function lastResults(list: Session[], n = 5): number[] {
  return list
    .filter((s) => s.endedAt)
    .sort((a, b) => a.endedAt! - b.endedAt!)
    .slice(-n)
    .map(profit);
}

function dayKey(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Result per calendar day (start of day → sum), by the day the session started. */
export function dailyResults(list: Session[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of list) {
    if (!s.endedAt) continue;
    const k = dayKey(s.startedAt);
    m.set(k, (m.get(k) ?? 0) + profit(s));
  }
  return m;
}

/** Weekday (0 = Sunday) with the best total result, with at least 2 sessions; null if none. */
export function bestWeekday(list: Session[]): { day: number; profit: number; sessions: number } | null {
  const acc = Array.from({ length: 7 }, () => ({ profit: 0, sessions: 0 }));
  for (const s of list) {
    if (!s.endedAt) continue;
    const d = new Date(s.startedAt).getDay();
    acc[d].profit += profit(s);
    acc[d].sessions++;
  }
  let best: { day: number; profit: number; sessions: number } | null = null;
  acc.forEach((a, day) => {
    if (a.sessions >= 2 && a.profit > 0 && (!best || a.profit > best.profit)) best = { day, ...a };
  });
  return best;
}
