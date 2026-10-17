// The month in poker: what it added up to, how it compares with the months
// before, and the line the notification on the 1st says about it. Pure, so it
// can be tested; the screen is /month and the scheduling lib/month-recap.ts.

import { locale, t } from '@/i18n';
import { rawMoney } from '@/poker/format';

import { mainCurrency, playedMs, profit } from './session-math';
import type { Session } from './types';

const H = 3600000;
/** When the recap notification goes out on the 1st, local time. */
export const RECAP_HOUR = 13;
/** Cash hours before a month shows a BB/h rate: one short session says nothing. */
export const MIN_BB_HOURS = 3;

/** "2026-10" for any moment in October 2026, local time. */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** First instant of the month, local time. */
export function monthStart(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).getTime();
}

/** The month before ("2026-01" → "2025-12"). */
export function prevKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 2, 1).getTime());
}

/** "Outubro", or "Outubro de 2026" with the year. */
export function monthName(key: string, withYear = false): string {
  const n = new Date(monthStart(key)).toLocaleDateString(locale, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' });
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export interface MonthRecap {
  key: string;
  currency: string;
  sessions: number;
  hours: number;
  profit: number;
  /** Money per hour; 0 without hours. */
  hourly: number;
  /** Cash only, each session in its own blinds; null under MIN_BB_HOURS of cash. */
  bbHourly: number | null;
  cashSessions: number;
  cashHours: number;
  mtts: number;
  /** Tournaments with a prize. */
  cashes: number;
  best: { session: Session; profit: number } | null;
  worst: { session: Session; profit: number } | null;
  venues: number;
}

/** Finished sessions that started in the month. */
export function inMonth(sessions: Session[], key: string): Session[] {
  return sessions.filter((s) => s.endedAt && monthKey(s.startedAt) === key);
}

/** The month in one currency (default: the one most of its sessions use). */
export function monthRecap(sessions: Session[], key: string, currency?: string): MonthRecap {
  const all = inMonth(sessions, key);
  const cur = currency ?? mainCurrency(all);
  const list = all.filter((s) => s.currency === cur);
  const hours = list.reduce((a, s) => a + playedMs(s), 0) / H;
  const res = list.map((s) => ({ session: s, profit: profit(s) }));
  const total = res.reduce((a, x) => a + x.profit, 0);
  const cash = res.filter((x) => x.session.kind === 'cash' && x.session.bb > 0 && playedMs(x.session) > 0);
  const cashHours = cash.reduce((a, x) => a + playedMs(x.session), 0) / H;
  const sorted = [...res].sort((a, b) => b.profit - a.profit);
  const mtts = list.filter((s) => s.kind === 'mtt');
  return {
    key,
    currency: cur,
    sessions: list.length,
    hours,
    profit: total,
    hourly: hours > 0 ? total / hours : 0,
    bbHourly: cashHours >= MIN_BB_HOURS ? cash.reduce((a, x) => a + x.profit / x.session.bb, 0) / cashHours : null,
    cashSessions: cash.length,
    cashHours,
    mtts: mtts.length,
    cashes: mtts.filter((s) => s.cashOut > 0).length,
    best: sorted[0] ?? null,
    worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    venues: new Set(list.map((s) => (s.venue || '').trim().toLowerCase()).filter(Boolean)).size,
  };
}

/** Months with finished sessions, newest first. */
export function recapMonths(sessions: Session[]): string[] {
  return [...new Set(sessions.filter((s) => s.endedAt).map((s) => monthKey(s.startedAt)))].sort().reverse();
}

/** The month to open by default: the last finished month with sessions, else the latest. */
export function defaultMonth(sessions: Session[], now = Date.now()): string | null {
  const months = recapMonths(sessions);
  const cur = monthKey(now);
  return months.find((k) => k < cur) ?? months[0] ?? null;
}

export interface MonthCompare {
  /** The six months up to and including this one, oldest first (empty months at 0). */
  history: { key: string; profit: number; hours: number }[];
  prev: MonthRecap | null;
  /** Average of the earlier months with sessions in the last six; null without any. */
  avg: { profit: number; hours: number; hourly: number; months: number } | null;
  /** 1 = best of the months with sessions in the window. */
  rank: number;
  of: number;
}

export function compareMonths(sessions: Session[], key: string, currency: string, n = 6): MonthCompare {
  const keys: string[] = [key];
  while (keys.length < n) keys.unshift(prevKey(keys[0]));
  const recaps = keys.map((k) => monthRecap(sessions, k, currency));
  const earlier = recaps.slice(0, -1).filter((r) => r.sessions > 0);
  const p = recaps[recaps.length - 2];
  const played = recaps.filter((r) => r.sessions > 0);
  const me = recaps[recaps.length - 1];
  const hrs = earlier.reduce((a, r) => a + r.hours, 0);
  return {
    history: recaps.map((r) => ({ key: r.key, profit: r.profit, hours: r.hours })),
    prev: p.sessions > 0 ? p : null,
    avg: earlier.length
      ? { profit: earlier.reduce((a, r) => a + r.profit, 0) / earlier.length, hours: hrs / earlier.length, hourly: hrs > 0 ? earlier.reduce((a, r) => a + r.profit, 0) / hrs : 0, months: earlier.length }
      : null,
    rank: played.filter((r) => r.profit > me.profit).length + 1,
    of: played.length,
  };
}

const oneDec = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 1 });
const signedMoney = (n: number, cur: string) => (n > 0 ? '+' : n < 0 ? '−' : '') + rawMoney(Math.abs(Math.round(n)), cur);

/**
 * What the notification on the 1st says. It shows on a locked phone, so it
 * carries no result (no money, no BB/h) unless the player turned on "show
 * amounts in notifications" and privacy mode is off; `hidden` covers both.
 */
export function recapNotice(r: MonthRecap, hidden: boolean): { title: string; body: string } {
  const month = monthName(r.key);
  const h = Math.round(r.hours);
  if (hidden) {
    return {
      title: r.sessions === 1 ? t('{month}: {h} h em 1 sessão', { month, h }) : t('{month}: {h} h em {n} sessões', { month, h, n: r.sessions }),
      body: t('O resumo do teu mês está pronto. Toca para o veres.'),
    };
  }
  // BB/h is cash only: it stands for the month only when the month was all cash.
  const rate = r.bbHourly !== null && r.cashSessions === r.sessions ? `${r.bbHourly > 0 ? '+' : ''}${oneDec(r.bbHourly)} BB/h` : signedMoney(r.profit, r.currency);
  const b = r.best && r.best.profit > 0 ? r.best : null;
  return {
    title: t('{month}: {h} h, {rate}', { month, h, rate }),
    body: b
      ? (b.session.venue || '').trim()
        ? t('Melhor sessão: {amount} em {venue}. Toca para veres o resumo do mês.', { amount: signedMoney(b.profit, r.currency), venue: b.session.venue!.trim() })
        : t('Melhor sessão: {amount}. Toca para veres o resumo do mês.', { amount: signedMoney(b.profit, r.currency) })
      : t('Toca para veres o resumo do mês.'),
  };
}

/** When the next recap goes out (the 1st at RECAP_HOUR) and which month it covers. */
export function nextRecap(now = Date.now()): { at: number; key: string } {
  const d = new Date(now);
  let at = new Date(d.getFullYear(), d.getMonth(), 1, RECAP_HOUR).getTime();
  if (at <= now) at = new Date(d.getFullYear(), d.getMonth() + 1, 1, RECAP_HOUR).getTime();
  return { at, key: prevKey(monthKey(at)) };
}
