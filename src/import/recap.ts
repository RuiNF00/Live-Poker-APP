// What an import brought in, said the way a player cares about it: how many
// sessions and hours, over which years, and which year was the best. This
// is the moment a switch from another app pays off, so it uses only what was
// imported plus what was already here. Pure, so it can be tested.

import { mainCurrency, playedMs, profit } from '@/store/session-math';
import type { Session } from '@/store/types';

export interface ImportRecap {
  sessions: number;
  hours: number;
  venues: number;
  /** First and last year in the file. */
  from: number | null;
  to: number | null;
  currency: string;
  /** Best year by result, in the main currency; the year with most hours when no year was up. */
  best: { year: number; profit: number; sessions: number; byHours: boolean } | null;
}

const yearOf = (ms: number) => new Date(ms).getFullYear();

/** `imported`: the sessions this import added. `all`: every session now in the app, for the best year. */
export function importRecap(imported: Session[], all: Session[]): ImportRecap {
  const done = imported.filter((s) => s.endedAt);
  const hours = done.reduce((a, s) => a + playedMs(s, s.endedAt) / 3_600_000, 0);
  const venues = new Set(done.map((s) => s.venue.trim().toLowerCase()).filter(Boolean)).size;
  const years = done.map((s) => yearOf(s.startedAt));
  const currency = mainCurrency(done.length ? done : all);

  const byYear = new Map<number, { profit: number; hours: number; sessions: number }>();
  for (const s of all) {
    if (!s.endedAt || s.currency !== currency) continue;
    const y = yearOf(s.startedAt);
    const x = byYear.get(y) ?? { profit: 0, hours: 0, sessions: 0 };
    x.profit += profit(s);
    x.hours += playedMs(s, s.endedAt) / 3_600_000;
    x.sessions++;
    byYear.set(y, x);
  }
  const rows = [...byYear].filter(([, x]) => x.sessions >= 3);
  let best: ImportRecap['best'] = null;
  const up = rows.filter(([, x]) => x.profit > 0).sort((a, b) => b[1].profit - a[1].profit)[0];
  if (up) best = { year: up[0], profit: up[1].profit, sessions: up[1].sessions, byHours: false };
  else {
    const most = rows.sort((a, b) => b[1].hours - a[1].hours)[0];
    if (most) best = { year: most[0], profit: most[1].profit, sessions: most[1].sessions, byHours: true };
  }

  return { sessions: done.length, hours, venues, from: years.length ? Math.min(...years) : null, to: years.length ? Math.max(...years) : null, currency, best };
}
