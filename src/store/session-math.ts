import type { Session } from './types';

/** Time actually at the table: wall time minus breaks. */
export function playedMs(s: Session, now = Date.now()): number {
  const end = s.endedAt ?? now;
  const breaks = s.breaks.reduce((a, b) => a + Math.max(0, (b.end ?? end) - b.start), 0);
  return Math.max(0, end - s.startedAt - breaks);
}

export function isPaused(s: Session): boolean {
  const last = s.breaks[s.breaks.length - 1];
  return !!last && last.end === undefined;
}

export function cost(s: Session): number {
  return s.buyIn * Math.max(1, s.entries) + (s.addOn || 0);
}

/** Share sold to backers, 0–1. */
export function soldShare(s: Session): number {
  return Math.min(1, Math.max(0, (s.staking?.sold ?? 0) / 100));
}

/** Result of the whole action, before staking and expenses. */
export function gross(s: Session): number {
  return (s.cashOut || 0) - cost(s);
}

/** What the backers paid you for their share (markup included). */
export function stakeIn(s: Session): number {
  return soldShare(s) * cost(s) * (s.staking?.markup || 1);
}

/** What you owe the backers from the prize. */
export function owedToBackers(s: Session): number {
  return soldShare(s) * (s.cashOut || 0);
}

/** Your own money in play. */
export function ownCost(s: Session): number {
  return cost(s) - stakeIn(s) + (s.expenses || 0);
}

/** Your result: your share of the prize, plus what backers paid, minus buy-ins and expenses. */
export function profit(s: Session): number {
  return (s.cashOut || 0) - owedToBackers(s) - ownCost(s);
}

export interface Breakdown {
  key: string;
  sessions: number;
  profit: number;
  hours: number;
  hourly: number;
}

/** Results grouped by venue or game, best first. */
export function breakdown(list: Session[], by: 'venue' | 'name'): Breakdown[] {
  const m = new Map<string, Breakdown>();
  for (const s of list) {
    if (!s.endedAt) continue;
    const key = (s[by] || '').trim();
    if (!key) continue;
    const b = m.get(key.toLowerCase()) ?? { key, sessions: 0, profit: 0, hours: 0, hourly: 0 };
    b.sessions++;
    b.profit += profit(s);
    b.hours += playedMs(s) / 3600000;
    m.set(key.toLowerCase(), b);
  }
  return [...m.values()].map((b) => ({ ...b, hourly: b.hours > 0 ? b.profit / b.hours : 0 })).sort((a, b) => b.profit - a.profit);
}

export interface Totals {
  sessions: number;
  profit: number;
  invested: number;
  hours: number;
  hourly: number;
  roi: number | null;
  itm: number | null;
  best: number;
  worst: number;
}

export function totals(list: Session[]): Totals {
  const done = list.filter((s) => s.endedAt);
  const p = done.reduce((a, s) => a + profit(s), 0);
  const inv = done.reduce((a, s) => a + Math.max(0, ownCost(s)), 0);
  const hours = done.reduce((a, s) => a + playedMs(s), 0) / 3600000;
  const mtts = done.filter((s) => s.kind === 'mtt');
  const mttInv = mtts.reduce((a, s) => a + Math.max(0, ownCost(s)), 0);
  const mttProfit = mtts.reduce((a, s) => a + profit(s), 0);
  const profits = done.map(profit);
  return {
    sessions: done.length,
    profit: p,
    invested: inv,
    hours,
    hourly: hours > 0 ? p / hours : 0,
    roi: mttInv > 0 ? (mttProfit / mttInv) * 100 : null,
    itm: mtts.length ? (mtts.filter((s) => s.cashOut > 0).length / mtts.length) * 100 : null,
    best: profits.length ? Math.max(...profits) : 0,
    worst: profits.length ? Math.min(...profits) : 0,
  };
}

/** Cumulative profit points, oldest first. */
export function curve(list: Session[]): { t: number; v: number }[] {
  const done = list.filter((s) => s.endedAt).sort((a, b) => a.endedAt! - b.endedAt!);
  let acc = 0;
  return [{ t: done[0]?.startedAt ?? Date.now(), v: 0 }, ...done.map((s) => ({ t: s.endedAt!, v: (acc += profit(s)) }))];
}
