// What swaps did over time: the net won or lost through them per partner, per series and in
// total (per currency, never mixed), and how much they evened out results. Pure, so it can be
// tested; the screen is src/app/swaps/history.tsx.

import { profit } from './session-math';
import { groupLedger, groupReady, type SwapGroup } from './swap-groups';
import { swapLedger, swapNames, other, type Swap } from './swaps';
import type { Session } from './types';

export interface HistoryLine {
  key: string;
  label: string;
  currency: string;
  /** Won (+) or lost (−) through swaps: my share of their prizes less what I gave from mine. */
  net: number;
  /** Swaps or groups counted. */
  deals: number;
  /** Prizes recorded on both sides. */
  prizes: number;
}

export interface SwapHistory {
  /** Enough to say something: at least MIN_PRIZES prizes recorded across confirmed swaps. */
  enough: boolean;
  prizes: number;
  total: HistoryLine[];
  byPartner: HistoryLine[];
  bySeries: HistoryLine[];
  /** How much swaps narrowed the spread of tournament results (null without enough tournaments). */
  variance: { sessions: number; currency: string; sdWithout: number; sdWith: number; reduction: number } | null;
}

export const MIN_PRIZES = 3;
export const MIN_SESSIONS = 8;
const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;

function bump(map: Map<string, HistoryLine>, key: string, label: string, currency: string, net: number, prizes: number) {
  const k = key + '|' + currency;
  const cur = map.get(k) ?? { key, label, currency, net: 0, deals: 0, prizes: 0 };
  cur.net = r2(cur.net + net);
  cur.deals++;
  cur.prizes += prizes;
  map.set(k, cur);
}

const sd = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

export function swapHistory(swaps: Swap[], groups: SwapGroup[], sessions: Session[]): SwapHistory {
  const partner = new Map<string, HistoryLine>();
  const series = new Map<string, HistoryLine>();
  const total = new Map<string, HistoryLine>();
  let prizes = 0;
  for (const s of swaps) {
    if (!s.confirmedAt) continue;
    const n = s.entries.filter((e) => e.kind === 'result' && e.amount > 0).length;
    prizes += n;
    const net = swapLedger(s).effect;
    const them = swapNames(s)[other(s.side)];
    bump(partner, them.trim().toLowerCase(), them, s.terms.currency, net, n);
    bump(series, s.terms.title.trim().toLowerCase(), s.terms.title, s.terms.currency, net, n);
    bump(total, '', '', s.terms.currency, net, n);
  }
  for (const g of groups) {
    if (!groupReady(g)) continue;
    const n = g.entries.filter((e) => e.kind === 'result' && e.amount > 0).length;
    prizes += n;
    const net = groupLedger(g).effect;
    bump(partner, 'group:' + g.id, g.terms.title, g.terms.currency, net, n);
    bump(series, g.terms.title.trim().toLowerCase(), g.terms.title, g.terms.currency, net, n);
    bump(total, '', '', g.terms.currency, net, n);
  }
  const byNet = (a: HistoryLine, b: HistoryLine) => b.net - a.net;

  // Spread with and without swaps, over finished tournaments where a swap moved the result.
  // Only the currency with the most of them, so amounts are never mixed.
  // A tournament is covered when a swap moved it, or it was played inside a series swap's
  // window (a bust there is part of the swapped spread too).
  const windows = [
    ...swaps.filter((s) => s.confirmedAt && s.terms.scope === 'series').map((s) => ({ cur: s.terms.currency, from: s.terms.createdAt, at: s.entries.map((e) => e.at) })),
    ...groups.filter((g) => groupReady(g) && g.terms.scope === 'series').map((g) => ({ cur: g.terms.currency, from: g.terms.createdAt, at: g.entries.map((e) => e.at) })),
  ].map((w) => ({ cur: w.cur, from: w.from - 2 * DAY, to: Math.max(w.from, ...w.at) + DAY }));
  const covered = sessions.filter(
    (s) => s.endedAt && s.kind === 'mtt' && (s.swapNet !== undefined || windows.some((w) => w.cur === s.currency && s.startedAt >= w.from && s.startedAt <= w.to)),
  );
  const counts = new Map<string, number>();
  for (const s of covered) counts.set(s.currency, (counts.get(s.currency) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  let variance: SwapHistory['variance'] = null;
  if (top && top[1] >= MIN_SESSIONS) {
    const list = covered.filter((s) => s.currency === top[0]);
    const withS = list.map((s) => profit(s));
    const without = list.map((s) => profit(s) - (s.swapNet || 0));
    const a = sd(without);
    const b = sd(withS);
    variance = { sessions: list.length, currency: top[0], sdWithout: r2(a), sdWith: r2(b), reduction: a > 0 ? Math.round((1 - b / a) * 100) / 100 : 0 };
  }

  return {
    enough: prizes >= MIN_PRIZES,
    prizes,
    total: [...total.values()].sort(byNet),
    byPartner: [...partner.values()].sort(byNet),
    bySeries: [...series.values()].sort(byNet),
    variance,
  };
}
