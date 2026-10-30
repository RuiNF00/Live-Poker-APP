// Deeper results: drawdowns on the profit curve, the spread of your results
// (standard deviation) and what that spread means over the next N hours or
// tournaments. Pure, so it can be tested.

import { t } from '@/i18n';

import { cost, mainCurrency, ownBuyIns, playedMs, profit, rateShown } from './session-math';
import { normCdf, sdPerHour } from './spread-math';
import type { Session } from './types';

export { normCdf };

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
 * h hours has variance h·σ², so σ² = Σ(resultᵢ − w·hᵢ)² / (H − Σhᵢ²/H) (sdPerHour).
 */
export function cashStats(list: Session[], currency = mainCurrency(list)): CashStats | null {
  const done = list.filter((s) => s.endedAt && s.kind === 'cash' && s.currency === currency && playedMs(s) > 0);
  if (done.length < 3) return null;
  const hrs = done.map((s) => playedMs(s) / 3600000);
  const res = done.map(profit);
  const hours = hrs.reduce((a, b) => a + b, 0);
  if (!rateShown(hours)) return null;
  const hourly = res.reduce((a, b) => a + b, 0) / hours;
  return { hours, sessions: done.length, hourly, sdHour: sdPerHour(res, hrs, hourly) };
}

export interface MttStats {
  tournaments: number;
  /** Average total cost (buy-ins, re-entries, add-ons). */
  avgBuyIn: number;
  /** % on your share of the buy-ins, the same figure as Bankroll and Torneios; null when all of it was sold. */
  roi: number | null;
  /** Standard deviation of one tournament's result, in buy-ins; never below a break-even player's in those fields (tourneySpread). */
  sdBuyIns: number;
  /**
   * Standard error of `roi`, in points. ROI is the total won over the total of your buy-ins, so a
   * 1 000 € event weighs ten times a 100 € one: its error is the ratio estimator's, from each
   * tournament's result against what the ROI says it should be (result − ROI × own buy-ins).
   */
  roiSe: number | null;
}

/** Field assumed for a tournament that didn't record one, when the player never recorded any. */
const USUAL_FIELD = 200;

/**
 * Standard deviation of one tournament's result, in buy-ins, for a break-even player in a field of
 * this size with 15% paid and a usual payout curve: about 0.85·∛field (2.8 at 30 players, 3.9 at
 * 100, 8.5 at 1 000, 16 at 5 000).
 */
export function tourneySpread(field: number): number {
  return 0.85 * Math.cbrt(Math.max(2, field));
}

/** Tournaments: ROI and the spread of one result measured in buy-ins (staking ignored, it's the game's variance). */
export function mttStats(list: Session[], currency = mainCurrency(list)): MttStats | null {
  const done = list.filter((s) => s.endedAt && s.kind === 'mtt' && s.currency === currency && cost(s) > 0);
  if (done.length < 5) return null;
  const bis = done.map((s) => (s.cashOut - cost(s)) / cost(s));
  const mean = bis.reduce((a, b) => a + b, 0) / bis.length;
  const sd = Math.sqrt(bis.reduce((a, b) => a + (b - mean) ** 2, 0) / (bis.length - 1));
  const paid = done.reduce((a, s) => a + cost(s), 0);
  const avgBuyIn = paid / done.length;
  // ROI on the total of your buy-ins, the same figure as Torneios and Bankroll (an average of each ROI weighs a 100€ win like a 1000€ one).
  const own = done.reduce((a, s) => a + ownBuyIns(s), 0);
  const net = done.reduce((a, s) => a + profit(s), 0);
  const n = done.length;
  const r = own > 0 ? net / own : 0;
  const ss = done.reduce((a, s) => a + (profit(s) - r * ownBuyIns(s)) ** 2, 0);
  // Tournament results are lopsided: most samples of 50 or 200 haven't met the deep run that pays for the
  // rest, so their own spread reads too small and a break-even player was told «já não é azar» 3 times in 10.
  // The spread never counts below what a break-even player's has in fields that size (tourneySpread).
  // A tournament without its field counts at the player's usual one (the median of those recorded).
  const fields = done.map((s) => s.field ?? 0).filter((f) => f > 0).sort((a, b) => a - b);
  const usual = fields.length ? fields[Math.floor(fields.length / 2)] : USUAL_FIELD;
  const floor = done.reduce((a, s) => a + (tourneySpread(s.field && s.field > 0 ? s.field : usual) * ownBuyIns(s)) ** 2, 0);
  const roiSe = own > 0 ? (Math.sqrt(Math.max((ss * n) / (n - 1), floor)) / own) * 100 : null;
  // The same floor for the variance calculator: a projection from a spread that hasn't met the deep run yet
  // would promise far narrower swings than tournaments give.
  const floorBi = Math.sqrt(done.reduce((a, s) => a + tourneySpread(s.field && s.field > 0 ? s.field : usual) ** 2, 0) / n);
  return { tournaments: n, avgBuyIn, roi: own > 0 ? r * 100 : null, sdBuyIns: Math.max(sd, floorBi), roiSe };
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

/** Cash hours and tournaments needed before the verdict says anything. */
export const VERDICT_MIN = { cashHours: 100, cashSessions: 20, tournaments: 50 };

export interface Verdict {
  /** False: still watching (sample too small). */
  ready: boolean;
  tone: 'good' | 'bad' | 'neutral';
  text: string;
}

/**
 * One sentence on whether the player wins, said only when the sample can
 * carry it: the win rate has to stay on one side of zero at 95% one-sided
 * (rate ± 1.645 standard errors). Cash by the hour; tournaments by ROI.
 */
export function verdict(list: Session[], currency: string, money: (n: number) => string): Verdict {
  const done = list.filter((s) => s.endedAt && s.currency === currency);
  const cash = cashStats(done, currency);
  const mtt = mttStats(done, currency);
  if (cash && cash.hours >= VERDICT_MIN.cashHours && cash.sessions >= VERDICT_MIN.cashSessions) {
    const se = cash.sdHour / Math.sqrt(cash.hours);
    const h = Math.round(cash.hours);
    const rate = money(Math.round(cash.hourly));
    if (cash.hourly - 1.645 * se > 0) return { ready: true, tone: 'good', text: t('Ganhas cerca de {rate}/h em cash, e com {h} h já não é sorte.', { rate, h }) };
    if (cash.hourly + 1.645 * se < 0) return { ready: true, tone: 'bad', text: t('Perdes cerca de {rate}/h em cash, e com {h} h já não é azar.', { rate: money(Math.round(-cash.hourly)), h }) };
    return { ready: true, tone: 'neutral', text: t('Com {h} h de cash, os teus {rate}/h ainda cabem na variância: nem dá para dizer que ganhas, nem que perdes.', { rate, h }) };
  }
  if (mtt && mtt.roi !== null && mtt.tournaments >= VERDICT_MIN.tournaments) {
    // The ROI's own error (an average of each tournament's ROI in buy-ins misjudges it as soon as the buy-ins differ).
    const se = mtt.roiSe ?? 0;
    const n = mtt.tournaments;
    const roi = `${Math.round(mtt.roi)}%`;
    if (mtt.roi - 1.645 * se > 0) return { ready: true, tone: 'good', text: t('Ganhas nos torneios: ROI de {roi} em {n} torneios, e já não é sorte.', { roi, n }) };
    if (mtt.roi + 1.645 * se < 0) return { ready: true, tone: 'bad', text: t('Perdes nos torneios: ROI de {roi} em {n} torneios, e já não é azar.', { roi, n }) };
    return { ready: true, tone: 'neutral', text: t('Com {n} torneios, um ROI de {roi} ainda cabe na variância dos torneios.', { roi, n }) };
  }
  return { ready: false, tone: 'neutral', text: done.length === 1 ? t('Ainda a observar (1 sessão): o veredito aparece com 100 h de cash ou 50 torneios.') : t('Ainda a observar ({n} sessões): o veredito aparece com 100 h de cash ou 50 torneios.', { n: done.length }) };
}

export interface Downswing {
  /** How far it fell from the peak (positive). */
  depth: number;
  /** When the peak was reached (end of that session; the first session's start for a fall from zero). */
  from: number;
  /** The lowest point (for the current one: the last session). */
  to: number;
  /** Sessions from the peak to the low (for the current one: to now). */
  sessions: number;
  /** When the curve got back to the peak; null while still below it. */
  recovered: number | null;
}

/**
 * The biggest downswing and the current one, on the profit curve of one
 * currency, plus the curve below its running peak (0 at a peak, negative
 * below), for the drawdown chart.
 */
export function downswings(list: Session[], currency: string): { underwater: number[]; biggest: Downswing | null; current: Downswing | null } {
  const done = list.filter((s) => s.endedAt && s.currency === currency).sort((a, b) => a.endedAt! - b.endedAt!);
  let v = 0;
  let peak = 0;
  let peakAt = done[0]?.startedAt ?? 0;
  let peakIdx = 0;
  let open: Downswing | null = null;
  let biggest: Downswing | null = null;
  const underwater = [0];
  done.forEach((s, i) => {
    v += profit(s);
    if (v >= peak) {
      if (open) open.recovered = s.endedAt!;
      open = null;
      peak = v;
      peakAt = s.endedAt!;
      peakIdx = i + 1;
    } else {
      const depth = peak - v;
      if (!open) open = { depth, from: peakAt, to: s.endedAt!, sessions: i + 1 - peakIdx, recovered: null };
      if (depth >= open.depth) Object.assign(open, { depth, to: s.endedAt!, sessions: i + 1 - peakIdx });
      if (!biggest || open.depth > biggest.depth) biggest = open;
    }
    underwater.push(v - peak);
  });
  // The current one is where the curve is now, not its deepest point since the peak (that one counts for the biggest).
  const last = done[done.length - 1];
  const current: Downswing | null = open && last ? { ...(open as Downswing), depth: peak - v, to: last.endedAt!, sessions: done.length - peakIdx } : null;
  return { underwater, biggest: biggest ? { ...(biggest as Downswing) } : null, current };
}

/** Fewest finished sessions before the downswing read says anything. */
export const DOWNSWING_MIN = 20;

export interface DownswingOdds {
  sessions: number;
  /** Average result per session the simulation assumes (the player's own). */
  mean: number;
  /** Biggest downswing in a typical run of this many sessions (median), and in 1 run of 20 (95th percentile). */
  typical: number;
  bad: number;
  /** Share of runs (0–1) with a downswing at least this deep. */
  atLeast: (depth: number) => number;
}

/**
 * Is a downswing normal for this player? Replays the player's own session
 * results in random order, with replacement, as many sessions as they have
 * played, and measures the biggest downswing of each run. No normal curve:
 * tournament results are far too skewed for one. Null below DOWNSWING_MIN.
 */
export function downswingOdds(results: number[], runs = 1000, seed = 7): DownswingOdds | null {
  const n = results.length;
  if (n < DOWNSWING_MIN) return null;
  // The hot loop (runs × sessions, 1.5 million steps for a heavy player): a typed
  // array and a seeded mulberry32 inlined, so it reads the same every time it is drawn.
  const res = Float64Array.from(results);
  const maxes = new Float64Array(runs);
  let a = seed >>> 0;
  for (let r = 0; r < runs; r++) {
    let v = 0;
    let peak = 0;
    let max = 0;
    for (let i = 0; i < n; i++) {
      a = (a + 0x6d2b79f5) >>> 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      v += res[Math.floor((((x ^ (x >>> 14)) >>> 0) / 4294967296) * n)];
      if (v > peak) peak = v;
      else if (peak - v > max) max = peak - v;
    }
    maxes[r] = max;
  }
  maxes.sort();
  const at = (q: number) => maxes[Math.min(runs - 1, Math.floor(q * runs))];
  return {
    sessions: n,
    mean: results.reduce((a, b) => a + b, 0) / n,
    typical: at(0.5),
    bad: at(0.95),
    atLeast: (depth) => {
      // First index with max >= depth (binary search on the sorted runs).
      let lo = 0;
      let hi = runs;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (maxes[mid] >= depth) hi = mid;
        else lo = mid + 1;
      }
      return (runs - lo) / runs;
    },
  };
}

/** A usual buy-in for the currency: the median of what one entry cost. */
export function usualBuyIn(list: Session[], currency: string): number {
  const v = list.filter((s) => s.endedAt && s.currency === currency && s.buyIn > 0).map((s) => s.buyIn).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
}
