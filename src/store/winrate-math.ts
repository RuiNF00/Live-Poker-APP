// Cash win rate with its uncertainty: per hour in money and in big blinds,
// the standard deviation, a 95% interval, and how many hours it takes before
// the interval is narrow enough to mean something. Pure, so it can be tested.
//
// A session of h hours has variance h·σ², so the win rate's standard error
// after H hours is σ/√H and the 95% interval is rate ± t·σ/√H, with t from
// Student's table for the sessions behind σ (1.96 once there are plenty).

import { t } from '@/i18n';

import { stakeKey, stakeLabel } from './bankroll-math';
import { playedMs, profit, rateShown } from './session-math';
import { sdPerHour, t95 } from './spread-math';
import type { Session } from './types';
import { handCounts, sessionGame } from '@/poker/variant';
import type { GameInfo } from '@/poker/types';

const H = 3600000;
const Z95 = 1.96;
/** A margin of ±5 BB/h is what live players can act on (moving up, picking games). */
export const USEFUL_BB = 5;
/** Below this, a group's win rate is mostly noise: shown with a warning. */
export const SMALL = { hours: 50, sessions: 10 };

export interface WinRate {
  sessions: number;
  hours: number;
  /** Money per hour, its standard deviation per hour, and the 95% interval. */
  hourly: number;
  sd: number;
  lo: number;
  hi: number;
  /** The same in big blinds per hour (each session in its own blinds). */
  bbHourly: number;
  sdBb: number;
  bbLo: number;
  bbHi: number;
  /** Hours and count of the sessions with blinds, the ones behind the BB figures. */
  bbHours: number;
  bbSessions: number;
  /**
   * Enough sessions with blinds (the same minimum as the win rate) for the BB figures to mean
   * something: with one, its spread is 0 and the range would read as certain.
   */
  bbKnown: boolean;
  /** Too few hours or sessions to lean on. */
  small: boolean;
}

/** Finished cash sessions in one currency with time played. */
export function cashDone(list: Session[], currency: string): Session[] {
  return list.filter((s) => s.endedAt && s.kind === 'cash' && s.currency === currency && playedMs(s) > 0);
}

/** Null with fewer than `min` sessions (the spread needs a few) or under MIN_RATE_HOURS of play. */
export function winRate(cash: Session[], min = 3): WinRate | null {
  if (cash.length < min) return null;
  const hrs = cash.map((s) => playedMs(s) / H);
  if (!rateShown(hrs.reduce((a, b) => a + b, 0))) return null;
  const res = cash.map(profit);
  const bbs = cash.map((s, i) => (s.bb > 0 ? res[i] / s.bb : 0));
  const hours = hrs.reduce((a, b) => a + b, 0);
  const hourly = res.reduce((a, b) => a + b, 0) / hours;
  const sd = sdPerHour(res, hrs, hourly);
  // In BB, only the sessions with blinds: an imported one without them would count its hours at 0 BB.
  const bbHrs = hrs.map((h, i) => (cash[i].bb > 0 ? h : 0));
  const bbHours = bbHrs.reduce((a, b) => a + b, 0);
  const bbHourly = bbHours ? bbs.reduce((a, b) => a + b, 0) / bbHours : 0;
  const sdBb = sdPerHour(bbs, bbHrs, bbHourly);
  const m = t95(cash.length) / Math.sqrt(hours);
  const bbSessions = bbHrs.filter((h) => h > 0).length;
  const mBb = bbHours ? t95(bbSessions) / Math.sqrt(bbHours) : 0;
  return {
    sessions: cash.length,
    hours,
    hourly,
    sd,
    lo: hourly - m * sd,
    hi: hourly + m * sd,
    bbHourly,
    sdBb,
    bbLo: bbHourly - mBb * sdBb,
    bbHi: bbHourly + mBb * sdBb,
    bbHours,
    bbSessions,
    bbKnown: bbSessions >= min,
    small: hours < SMALL.hours || cash.length < SMALL.sessions,
  };
}

export interface HoursToKnow {
  /** Hours for the 95% interval to be ±USEFUL_BB BB/h wide. */
  needed: number;
  /** Still to play (0 when there already). */
  left: number;
  /** The margin today, ±BB/h. */
  margin: number;
  /** Hours played with blinds so far (what `needed` is measured against). */
  have: number;
  /** Sessions of the player's usual length that `left` comes to. */
  sessions: number;
}

/** How long until the win rate is known within ±USEFUL_BB BB/h, at 95%. */
export function hoursToKnow(w: WinRate, useful = USEFUL_BB): HoursToKnow {
  // In hours with blinds: the BB spread comes from those, and an imported session without blinds isn't BB data.
  const have = w.bbHours;
  const needed = Math.ceil(((Z95 * w.sdBb) / useful) ** 2);
  const left = Math.max(0, needed - have);
  const per = w.hours / w.sessions;
  // Today's margin is the BB bar's own half-width (Student's t for the sessions behind it); the hours
  // needed look ahead to a sample big enough for 1.96.
  return { needed, left: Math.ceil(left), margin: have > 0 ? (t95(w.bbSessions) * w.sdBb) / Math.sqrt(have) : 0, have, sessions: per > 0 ? Math.ceil(left / per) : 0 };
}

export type WinRateBy = 'game' | 'stake' | 'venue' | 'weekday';

/** NLH unless the name says otherwise, or most of the session's hands are PLO (`counts` from `handCounts`). */
export function gameOf(s: Session, counts?: Map<string, { plo: number; all: number }>): string {
  const c = counts?.get(s.id);
  return sessionGame(s.name ?? '', c?.plo, c?.all);
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const WEEKDAYS = () => [t('domingo'), t('segunda'), t('terça'), t('quarta'), t('quinta'), t('sexta'), t('sábado')].map(cap);

export interface WinRateGroup {
  label: string;
  w: WinRate;
}

/** Win rate per game, stake, venue or weekday; groups of 2+ sessions, most hours first. */
export function winRateBy(cash: Session[], by: WinRateBy, currency: string, hands: { sessionId?: string; game: Pick<GameInfo, 'variant'> }[] = []): WinRateGroup[] {
  const counts = by === 'game' ? handCounts(hands) : undefined;
  const days = WEEKDAYS();
  const key = (s: Session): string | null =>
    by === 'game' ? gameOf(s, counts) : by === 'stake' ? stakeLabel(stakeKey(s), currency) : by === 'venue' ? (s.venue || '').trim() || null : days[new Date(s.startedAt).getDay()];
  const groups = new Map<string, Session[]>();
  for (const s of cash) {
    const k = key(s);
    if (k) groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([label, l]) => ({ label, w: winRate(l, 2) }))
    .filter((g): g is WinRateGroup => g.w !== null)
    .sort((a, b) => b.w.hours - a.w.hours);
}
