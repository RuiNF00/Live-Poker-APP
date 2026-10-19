// "O meu ano no póquer": the player's year in a few cards (Spotify Wrapped
// style). Only real numbers from their own data; a card with nothing to say
// is left out. Money is in the currency most sessions were played in, never
// added across currencies. Pure, so it can be tested.

import type { Hand } from '@/poker/types';
import { downswings, type Downswing } from '@/store/results-math';
import { mainCurrency, ownBuyIns, playedMs, profit } from '@/store/session-math';
import { weekStart, type Pause } from '@/store/streak';
import type { Session } from '@/store/types';

import { potInBB } from './session-card';

const HOUR = 3_600_000;
/** A stake needs this much play behind it before it can be called best or worst. */
export const STAKE_MIN_SESSIONS = 2;
export const STAKE_MIN_HOURS = 3;
/** Fewer finished sessions than this and there is no year to look back on. */
export const YEAR_MIN_SESSIONS = 3;

export interface StakeRow {
  key: string;
  kind: 'cash' | 'mtt';
  /** Blinds for cash ("5/10"), the buy-in for tournaments (an amount, so the screen hides it with the money). */
  sb: number;
  bb: number;
  buyIn: number;
  sessions: number;
  hours: number;
  profit: number;
  hourly: number;
  /** Cash: big blinds won per hour, a rate that says nothing about money. */
  bbPerHour: number | null;
  /** Tournaments: return on your own buy-ins. */
  roi: number | null;
}

export interface YearReview {
  year: number;
  currency: string;
  sessions: number;
  hours: number;
  hands: number;
  venues: number;
  topVenue: string | null;
  countries: string[];
  profit: number;
  hourly: number | null;
  best: { session: Session; profit: number } | null;
  /** The biggest tournament prize of the year. */
  score: { session: Session; prize: number } | null;
  stakes: StakeRow[];
  bestStake: StakeRow | null;
  worstStake: StakeRow | null;
  pot: { hand: Hand; bb: number } | null;
  /** Longest run of weeks in a row with a hand or a note logged; weeks on pause don't break it. */
  streak: number;
  weeksLogged: number;
  /** One entry per week of the year (weeks starting in it), true when something was logged. */
  weekMap: boolean[];
  /** January to December in the main currency (months without play at 0). */
  months: { month: number; profit: number; hours: number; sessions: number }[];
  /** The month that won most; null when none won. */
  bestMonth: { month: number; profit: number } | null;
  /** The year's deepest fall from a high (sessions of this year only), and when it was won back. */
  downswing: Downswing | null;
}

export const yearOf = (ms: number) => new Date(ms).getFullYear();

/** Years with finished sessions, newest first. */
export function reviewYears(sessions: Session[]): number[] {
  return [...new Set(sessions.filter((s) => s.endedAt).map((s) => yearOf(s.startedAt)))].sort((a, b) => b - a);
}

/** The year to open on: last year through January (the year just ended), otherwise this one. */
export function defaultYear(sessions: Session[], now = Date.now()): number | null {
  const d = new Date(now);
  const enough = (y: number) => sessions.filter((s) => s.endedAt && yearOf(s.startedAt) === y).length >= YEAR_MIN_SESSIONS;
  const order = d.getMonth() === 0 ? [d.getFullYear() - 1, d.getFullYear()] : [d.getFullYear(), d.getFullYear() - 1];
  return order.find(enough) ?? null;
}

function stakeKey(s: Session) {
  return s.kind === 'cash' ? `cash|${s.sb}/${s.bb}` : `mtt|${s.buyIn}`;
}

function addWeek(w: number) {
  // Through setDate, so a daylight-saving change never shifts the boundary.
  const d = new Date(w);
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

function weeksOf(year: number): number[] {
  const out: number[] = [];
  let w = weekStart(new Date(year, 0, 1).getTime());
  if (yearOf(w) < year) w = addWeek(w);
  for (; yearOf(w) === year; w = addWeek(w)) out.push(w);
  return out;
}

function longestRun(activity: number[], pauses: Pause[], year: number): { streak: number; weeks: number; map: boolean[] } {
  const logged = new Set(activity.filter((t) => yearOf(t) === year).map(weekStart));
  const map = weeksOf(year).map((w) => logged.has(w));
  if (!logged.size) return { streak: 0, weeks: 0, map };
  const paused = (w: number) => pauses.some((p) => p.from < w + 7 * 24 * HOUR && (p.to ?? Infinity) > w);
  let run = 0;
  let best = 0;
  const first = Math.min(...logged);
  const last = Math.max(...logged);
  for (let w = first; w <= last; ) {
    if (logged.has(w)) best = Math.max(best, ++run);
    else if (!paused(w)) run = 0;
    w = addWeek(w);
  }
  return { streak: best, weeks: logged.size, map };
}

/**
 * Most a hand's pot can hold, in big blinds, without replaying it. Each player
 * who put chips in by choice adds at most their stack, and at most the biggest
 * bet of the hand on each street dealt; forced blinds and antes come on top.
 * Infinity when a stack is unknown.
 */
export function potCeilingBB(h: Hand): number {
  const { sb, bb, ante } = h.game;
  if (!bb) return 0;
  const n = h.board.length;
  const streets = 1 + (n >= 3 ? 1 : 0) + (n >= 4 ? 1 : 0) + (n >= 5 ? 1 : 0);
  const top = Math.max(bb, ...h.actions.map((a) => a.to ?? 0));
  const inPot = new Set(h.actions.filter((a) => a.kind === 'call' || a.kind === 'bet' || a.kind === 'raise').map((a) => a.p));
  let chips = sb + bb + (ante || 0) * h.players.length;
  for (const i of inPot) {
    const st = h.players[i]?.stack;
    if (!(st > 0)) return Infinity;
    chips += Math.min(st, streets * top);
  }
  return chips / bb;
}

/** Pot sizes already worked out, per hand object (an edited hand is a new object). */
const POTS = new WeakMap<Hand, number>();
export function cachedPotBB(h: Hand): number {
  let v = POTS.get(h);
  if (v === undefined) POTS.set(h, (v = potInBB(h)));
  return v;
}

/** The biggest pot, replaying only the hands whose ceiling could still beat the best so far (a full replay of 10 000 hands is too slow for a screen). */
export function biggestPot(hands: Hand[]): { hand: Hand; bb: number } | null {
  const order = hands.map((h) => ({ h, cap: potCeilingBB(h) })).sort((a, b) => b.cap - a.cap);
  let best: { hand: Hand; bb: number } | null = null;
  for (const { h, cap } of order) {
    if (best && cap <= best.bb) break;
    const bb = cachedPotBB(h);
    if (bb > 0 && (!best || bb > best.bb)) best = { hand: h, bb };
  }
  return best;
}

/** This year's hands, for warming the pot cache. */
export const handsOfYear = (hands: Hand[], year: number) => hands.filter((h) => yearOf(h.createdAt) === year);

/**
 * `activity`: when something was logged (hands, session notes, player notes),
 * as for the streak on the home tab.
 */
export function yearReview(year: number, sessions: Session[], hands: Hand[], activity: number[] = [], pauses: Pause[] = [], opts: { pot?: boolean } = {}): YearReview {
  const done = sessions.filter((s) => s.endedAt && yearOf(s.startedAt) === year);
  const currency = mainCurrency(done);
  const main = done.filter((s) => s.currency === currency);
  const hoursOf = (s: Session) => playedMs(s, s.endedAt) / HOUR;

  const venueCount = new Map<string, number>();
  for (const s of done) {
    const v = s.venue.trim();
    if (v) venueCount.set(v, (venueCount.get(v) ?? 0) + 1);
  }
  const topVenue = [...venueCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const countries = [...new Set(done.map((s) => s.country).filter((c): c is string => !!c))];

  const hours = done.reduce((a, s) => a + hoursOf(s), 0);
  const mainHours = main.reduce((a, s) => a + hoursOf(s), 0);
  const total = main.reduce((a, s) => a + profit(s), 0);

  let best: YearReview['best'] = null;
  for (const s of main) {
    const p = profit(s);
    if (p > 0 && (!best || p > best.profit)) best = { session: s, profit: p };
  }
  let score: YearReview['score'] = null;
  for (const s of main) if (s.kind === 'mtt' && s.cashOut > 0 && (!score || s.cashOut > score.prize)) score = { session: s, prize: s.cashOut };

  const groups = new Map<string, Session[]>();
  for (const s of main) groups.set(stakeKey(s), [...(groups.get(stakeKey(s)) ?? []), s]);
  const stakes: StakeRow[] = [];
  for (const [key, list] of groups) {
    const h = list.reduce((a, s) => a + hoursOf(s), 0);
    if (list.length < STAKE_MIN_SESSIONS || h < STAKE_MIN_HOURS) continue;
    const p = list.reduce((a, s) => a + profit(s), 0);
    const s0 = list[0];
    const spent = list.reduce((a, s) => a + ownBuyIns(s), 0);
    stakes.push({
      key,
      kind: s0.kind,
      sb: s0.sb,
      bb: s0.bb,
      buyIn: s0.buyIn,
      sessions: list.length,
      hours: h,
      profit: p,
      hourly: p / h,
      bbPerHour: s0.kind === 'cash' && s0.bb ? p / s0.bb / h : null,
      roi: s0.kind === 'mtt' && spent ? p / spent : null,
    });
  }
  stakes.sort((a, b) => b.hourly - a.hourly);

  const yearHands = hands.filter((h) => yearOf(h.createdAt) === year);
  // The screen asks without the pot first and adds it once cachedPotBB has warmed up in slices.
  const pot = opts.pot === false ? null : biggestPot(yearHands);

  const months = Array.from({ length: 12 }, (_, month) => ({ month, profit: 0, hours: 0, sessions: 0 }));
  for (const s of main) {
    const m = months[new Date(s.startedAt).getMonth()];
    m.profit += profit(s);
    m.hours += hoursOf(s);
    m.sessions++;
  }
  const top = [...months].sort((a, b) => b.profit - a.profit)[0];
  const ds = downswings(main, currency).biggest;

  const run = longestRun(activity, pauses, year);
  return {
    year,
    currency,
    sessions: done.length,
    hours,
    hands: yearHands.length,
    venues: venueCount.size,
    topVenue,
    countries,
    profit: total,
    hourly: mainHours >= 1 ? total / mainHours : null,
    best,
    score,
    stakes,
    bestStake: stakes[0] ?? null,
    worstStake: stakes.length >= 2 ? stakes[stakes.length - 1] : null,
    pot,
    streak: run.streak,
    weeksLogged: run.weeks,
    weekMap: run.map,
    months,
    bestMonth: top.sessions && top.profit > 0 ? { month: top.month, profit: top.profit } : null,
    downswing: ds && ds.depth > 0 ? ds : null,
  };
}

export type YearCardKind = 'year' | 'best' | 'stakes' | 'bankroll' | 'pot' | 'streak';

/** Cards in order; the first two are free. A card with nothing real to show is left out. */
export function yearCards(r: YearReview): YearCardKind[] {
  const out: YearCardKind[] = ['year'];
  if (r.best || r.score) out.push('best');
  if (r.bestStake || r.hourly !== null) out.push('stakes');
  // The year as a bankroll: months and the deepest fall. Needs at least two months played.
  if (r.months.filter((m) => m.sessions).length >= 2 && (r.bestMonth || r.downswing)) out.push('bankroll');
  if (r.pot) out.push('pot');
  if (r.weeksLogged) out.push('streak');
  return out;
}

export const FREE_YEAR_CARDS = 2;
