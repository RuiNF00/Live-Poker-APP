// Exchange rates: one table of daily ECB rates (base EUR), and everything a
// player's money adds up to in their own currency. Pure, so it can be tested.
//
// Each session and transfer is converted at its own day's rate, so a year's
// profit is what it was worth when it was won. Net worth uses the latest rate.

import { balanceOf } from './bankroll-math';
import { CURRENCY_INFO, isoOf } from './currencies';
import { ownCost, profit } from './session-math';
import type { Bankroll, Session, Transfer } from './types';

/** Stored currency values, as ISO codes. */
export const ISO: Record<string, string> = Object.fromEntries(Object.entries(CURRENCY_INFO).map(([k, v]) => [k, v.code]));

/** Rates the player typed for currencies the ECB doesn't publish: ISO code → units per 1 EUR. */
export type ManualRates = Record<string, number>;

/** 'YYYY-MM-DD' → ISO code → units of that currency per 1 EUR. EUR itself is never stored. */
export type RateTable = Record<string, Record<string, number>>;

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const sorted = new WeakMap<RateTable, Map<string, string[]>>();

/** Dates in the table that have `iso`, oldest first (kept per table: a year of sessions looks them up often). */
function daysWith(table: RateTable, iso: string): string[] {
  let m = sorted.get(table);
  if (!m) sorted.set(table, (m = new Map()));
  let days = m.get(iso);
  if (!days) m.set(iso, (days = Object.keys(table).filter((k) => table[k][iso] > 0).sort()));
  return days;
}

/**
 * Units of `iso` per EUR on a day: that day's rate, else the last one before
 * it (weekends, holidays), else the first one after. Null when the table has none.
 */
export function eurRate(table: RateTable, iso: string, day: string, days = daysWith(table, iso)): number | null {
  if (iso === 'EUR') return 1;
  if (!days.length) return null;
  let lo = 0;
  let hi = days.length - 1;
  if (day < days[0]) return table[days[0]][iso];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (days[mid] <= day) lo = mid;
    else hi = mid - 1;
  }
  return table[days[lo]][iso];
}

/** Rate from one currency to another on a day (ECB, else a typed rate); null without one for either. */
export function rate(table: RateTable, from: string, to: string, ts: number, manual: ManualRates = {}): number | null {
  if (from === to) return 1;
  const a = ISO[from] ?? isoOf(from);
  const b = ISO[to] ?? isoOf(to);
  if (!a || !b) return null;
  const day = dayKey(ts);
  const ra = eurRate(table, a, day) ?? (manual[a] > 0 ? manual[a] : null);
  const rb = eurRate(table, b, day) ?? (manual[b] > 0 ? manual[b] : null);
  return ra && rb ? rb / ra : null;
}

/** The newest date in the table, if any. */
export function latestDay(table: RateTable): string | null {
  const keys = Object.keys(table).sort();
  return keys[keys.length - 1] ?? null;
}

export interface HomeTotals {
  currency: string;
  /** Every bankroll's balance, at the latest rate. */
  netWorth: number;
  /** Finished sessions in [from, to], each at its own day's rate. */
  profit: number;
  sessions: number;
  /** Tournaments: profit on your own money, null without any. */
  roi: number | null;
  /** Currencies with money in them but no rate: left out. */
  missing: string[];
  /** More than one currency went into these numbers. */
  mixed: boolean;
}

/** Everything in the player's own currency. */
export function homeTotals(
  d: { sessions: Session[]; transfers: Transfer[]; bankrolls: Bankroll[] },
  home: string,
  table: RateTable,
  range: { from?: number; to?: number },
  now = Date.now(),
  manual: ManualRates = {},
): HomeTotals {
  const missing = new Set<string>();
  const used = new Set<string>();
  let netWorth = 0;
  for (const b of d.bankrolls) {
    const bal = balanceOf({ bankrollId: b.id }, d.sessions, d.transfers, d.bankrolls).balance;
    if (!bal) continue;
    const r = rate(table, b.currency, home, now, manual);
    if (r === null) {
      missing.add(b.currency);
      continue;
    }
    used.add(b.currency);
    netWorth += bal * r;
  }
  let p = 0;
  let n = 0;
  let mttInv = 0;
  let mttProfit = 0;
  for (const s of d.sessions) {
    if (!s.endedAt || (range.from !== undefined && s.startedAt < range.from) || (range.to !== undefined && s.startedAt > range.to)) continue;
    const r = rate(table, s.currency, home, s.startedAt, manual);
    if (r === null) {
      missing.add(s.currency);
      continue;
    }
    used.add(s.currency);
    const v = profit(s) * r;
    p += v;
    n++;
    if (s.kind === 'mtt') {
      mttInv += Math.max(0, ownCost(s)) * r;
      mttProfit += v;
    }
  }
  return { currency: home, netWorth, profit: p, sessions: n, roi: mttInv > 0 ? (mttProfit / mttInv) * 100 : null, missing: [...missing], mixed: used.size > 1 || (used.size === 1 && !used.has(home)) };
}

/**
 * Merges a Frankfurter v1 response (`{ rates: { 'YYYY-MM-DD': { USD: 1.09 } } }`,
 * base EUR, or `{ date, rates: { USD: 1.09 } }` for one day) into the table.
 * Anything else is ignored: a bad answer never breaks the cache.
 */
export function mergeRates(table: RateTable, body: unknown): RateTable {
  if (!body || typeof body !== 'object') return table;
  const b = body as { base?: unknown; date?: unknown; rates?: unknown };
  if (b.base !== undefined && b.base !== 'EUR') return table;
  if (!b.rates || typeof b.rates !== 'object') return table;
  const out: RateTable = { ...table };
  const add = (day: string, row: unknown) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !row || typeof row !== 'object') return;
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) if (typeof v === 'number' && v > 0 && Number.isFinite(v)) clean[k] = v;
    if (Object.keys(clean).length) out[day] = { ...out[day], ...clean };
  };
  const rates = b.rates as Record<string, unknown>;
  if (typeof b.date === 'string' && Object.values(rates).every((v) => typeof v === 'number')) add(b.date, rates);
  else for (const [day, row] of Object.entries(rates)) add(day, row);
  return out;
}
