// Cash win rate with its uncertainty: per hour in money and in big blinds,
// the standard deviation, a 95% interval, and how many hours it takes before
// the interval is narrow enough to mean something. Pure, so it can be tested.
//
// A session of h hours has variance h·σ², so the win rate's standard error
// after H hours is σ/√H and the 95% interval is rate ± 1.96·σ/√H.

import { t } from '@/i18n';

import { stakeKey, stakeLabel } from './bankroll-math';
import { playedMs, profit } from './session-math';
import type { Session } from './types';

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
  /** Too few hours or sessions to lean on. */
  small: boolean;
}

/** Finished cash sessions in one currency with time played. */
export function cashDone(list: Session[], currency: string): Session[] {
  return list.filter((s) => s.endedAt && s.kind === 'cash' && s.currency === currency && playedMs(s) > 0);
}

/** Null with fewer than `min` sessions (the spread needs a few). */
export function winRate(cash: Session[], min = 3): WinRate | null {
  if (cash.length < min) return null;
  const hrs = cash.map((s) => playedMs(s) / H);
  const res = cash.map(profit);
  const bbs = cash.map((s, i) => (s.bb > 0 ? res[i] / s.bb : 0));
  const hours = hrs.reduce((a, b) => a + b, 0);
  const rate = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / hours;
  const spread = (xs: number[], w: number) => Math.sqrt(xs.reduce((a, x, i) => a + (x - w * hrs[i]) ** 2, 0) / hours);
  const hourly = rate(res);
  const sd = spread(res, hourly);
  const bbHourly = rate(bbs);
  const sdBb = spread(bbs, bbHourly);
  const m = Z95 / Math.sqrt(hours);
  return {
    sessions: cash.length,
    hours,
    hourly,
    sd,
    lo: hourly - m * sd,
    hi: hourly + m * sd,
    bbHourly,
    sdBb,
    bbLo: bbHourly - m * sdBb,
    bbHi: bbHourly + m * sdBb,
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
  /** Sessions of the player's usual length that `left` comes to. */
  sessions: number;
}

/** How long until the win rate is known within ±USEFUL_BB BB/h, at 95%. */
export function hoursToKnow(w: WinRate, useful = USEFUL_BB): HoursToKnow {
  const needed = Math.ceil(((Z95 * w.sdBb) / useful) ** 2);
  const left = Math.max(0, needed - w.hours);
  const per = w.hours / w.sessions;
  return { needed, left: Math.ceil(left), margin: (Z95 * w.sdBb) / Math.sqrt(w.hours), sessions: per > 0 ? Math.ceil(left / per) : 0 };
}

export type WinRateBy = 'game' | 'stake' | 'venue' | 'weekday';

/** NLH unless the name says otherwise. */
export function gameOf(s: Session): string {
  const n = s.name ?? '';
  if (/plo|omaha/i.test(n)) return 'PLO';
  if (/mix|horse|8-game|dealer'?s choice/i.test(n)) return 'Mix';
  if (/short ?deck|6\+/i.test(n)) return 'Short Deck';
  return 'NLH';
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const WEEKDAYS = () => [t('domingo'), t('segunda'), t('terça'), t('quarta'), t('quinta'), t('sexta'), t('sábado')].map(cap);

export interface WinRateGroup {
  label: string;
  w: WinRate;
}

/** Win rate per game, stake, venue or weekday; groups of 2+ sessions, most hours first. */
export function winRateBy(cash: Session[], by: WinRateBy, currency: string): WinRateGroup[] {
  const days = WEEKDAYS();
  const key = (s: Session): string | null =>
    by === 'game' ? gameOf(s) : by === 'stake' ? stakeLabel(stakeKey(s), currency) : by === 'venue' ? (s.venue || '').trim() || null : days[new Date(s.startedAt).getDay()];
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
