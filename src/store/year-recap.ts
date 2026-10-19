// "O teu ano no póquer" notification (notificacoes.md row 16): 31 December at
// 18:00, with 3 or more sessions that year, once a year. A live session holds
// it; it then goes out at the next opening, up to 7 January. Pure, so it can be
// tested; the scheduling is in lib/month-recap.tsx.

import { t } from '@/i18n';
import { rawMoney } from '@/poker/format';
import { YEAR_MIN_SESSIONS } from '@/share/year-review';

import { mainCurrency, playedMs, profit } from './session-math';
import type { Session } from './types';

export const YEAR_RECAP_HOUR = 18;
/** A held notice still goes out at an opening up to this day of January. */
const LATE_UNTIL_DAY = 7;
/** A live session this close to 18:00 holds the notice. */
const HOLD_MS = 12 * 3600000;

export type YearRecapPlan = { kind: 'at'; at: number; year: number } | { kind: 'now'; year: number } | { kind: 'none'; held?: boolean };

/** What to do now: schedule for 31 Dec, send right away (held or missed), or nothing. `sent`: the last year it went out. */
export function planYearRecap(now: number, sent: number | undefined, live: boolean): YearRecapPlan {
  const d = new Date(now);
  const late = d.getMonth() === 0 && d.getDate() <= LATE_UNTIL_DAY;
  const year = late ? d.getFullYear() - 1 : d.getFullYear();
  if (sent === year) return { kind: 'none' };
  const at = new Date(year, 11, 31, YEAR_RECAP_HOUR).getTime();
  if (now < at) return live && at - now < HOLD_MS ? { kind: 'none', held: true } : { kind: 'at', at, year };
  if (live) return { kind: 'none', held: true };
  return late || d.getMonth() === 11 ? { kind: 'now', year } : { kind: 'none' };
}

/** The year's finished sessions, or null under the minimum. */
export function yearSessions(sessions: Session[], year: number): Session[] | null {
  const list = sessions.filter((s) => s.endedAt && new Date(s.startedAt).getFullYear() === year);
  return list.length >= YEAR_MIN_SESSIONS ? list : null;
}

/** The notice: hours and sessions; the result only when amounts may show on a locked phone. */
export function yearNotice(list: Session[], year: number, hidden: boolean): { title: string; body: string } {
  const h = Math.round(list.reduce((a, s) => a + playedMs(s, s.endedAt), 0) / 3600000);
  const title = t('O teu {year} no póquer', { year });
  if (hidden) return { title, body: t('{h} h em {n} sessões. O resumo do teu ano está pronto.', { h, n: list.length }) };
  const cur = mainCurrency(list);
  const p = Math.round(list.filter((s) => s.currency === cur).reduce((a, s) => a + profit(s), 0));
  const amount = (p > 0 ? '+' : p < 0 ? '−' : '') + rawMoney(Math.abs(p), cur);
  return { title, body: t('{h} h em {n} sessões, {amount}. O resumo do teu ano está pronto.', { h, n: list.length, amount }) };
}
