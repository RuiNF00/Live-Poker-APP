// What a player needs for a tax return: per country and currency, the
// winning and losing sessions, tax withheld at the cashier and whether it is
// coming back. Plus, for US filers, the loss deduction (90% of losses from
// 2026, never more than the winnings). Facts only, not advice. Pure, so it
// can be tested.

import { inRange, type DateRange } from '@/store/bankroll-math';
import { ownBounties, profit, resultAt, soldShare } from '@/store/session-math';
import { EXPENSE_KINDS, toTripCurrency } from '@/store/trip-math';
import type { ExpenseKind, Session, Trip } from '@/store/types';

export interface TaxRow {
  country: string;
  currency: string;
  sessions: number;
  /** Sum of the winning sessions. */
  wins: number;
  /** Sum of the losing sessions, as a positive number. */
  losses: number;
  net: number;
  withheld: number;
  toRecover: number;
  recovered: number;
  docs: number;
  /** Tax was withheld on a session with backers: the amount is the whole document's, not split. */
  backedWithheld: boolean;
  /** Your bounties (PKO): already in the winnings, shown apart. */
  bounties: number;
}

export interface UsLosses {
  currency: string;
  wins: number;
  losses: number;
  /** What a US filer can deduct: 90% of losses from 2026 (100% before), up to the winnings. */
  deductible: number;
  /** Winnings left after the deduction. */
  taxable: number;
  /** Losses that can't be deducted because of the 90% rule. */
  lostToCap: number;
  /** The tax year, when the range covers more than one. */
  year?: number;
}

export interface TaxReport {
  rows: TaxRow[];
  /** Shown when anything points at US taxes: a session in the US, or a W-2G or 1042-S. */
  us: UsLosses[] | null;
  /** Withheld and still to recover, per currency. */
  pending: { currency: string; amount: number }[];
  /** Poker expenses per currency: trip expenses by kind, plus the expenses typed on sessions. */
  expenses: { currency: string; byKind: Record<ExpenseKind, number>; sessions: number; total: number }[];
  /** Some result in the range includes swaps or staking, so the PDF says what the numbers count. */
  sharesIncluded: boolean;
}

/** The gambling result of a session: your share, before travel and other expenses (those are listed apart). */
export function gamblingResult(s: Session): number {
  return profit(s) + (s.expenses || 0) + (s.tips || 0);
}

/** Share of losses a US filer can deduct for a session in this year. */
export function usLossShare(year: number): number {
  return year >= 2026 ? 0.9 : 1;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** `trips`: the trips in the range (from the report), for their expenses. */
export function taxReport(sessions: Session[], range: DateRange, trips: { trip: Pick<Trip, 'currency' | 'fx' | 'expenses'> }[] = []): TaxReport {
  const list = sessions.filter((s) => s.endedAt && inRange(resultAt(s), range));
  const rows = new Map<string, TaxRow>();
  for (const s of list) {
    const key = `${s.country ?? ''}|${s.currency}`;
    const row = rows.get(key) ?? { country: s.country ?? '', currency: s.currency, sessions: 0, wins: 0, losses: 0, net: 0, withheld: 0, toRecover: 0, recovered: 0, docs: 0, backedWithheld: false, bounties: 0 };
    const g = gamblingResult(s);
    row.sessions++;
    if (g > 0) row.wins += g;
    else row.losses -= g;
    row.net += g;
    const w = s.withheld?.amount ?? 0;
    row.withheld += w;
    if (s.withheld?.status === 'recover') row.toRecover += w;
    if (s.withheld?.status === 'recovered') row.recovered += w;
    if (w && soldShare(s) > 0) row.backedWithheld = true;
    row.docs += s.docs?.length ?? 0;
    // «Of which bounties»: only those inside the wins, so the column is never more than the wins.
    if (g > 0) row.bounties += Math.min(ownBounties(s), g);
    rows.set(key, row);
  }
  const out = [...rows.values()]
    .map((x) => ({ ...x, wins: r2(x.wins), losses: r2(x.losses), net: r2(x.net), withheld: r2(x.withheld), toRecover: r2(x.toRecover), recovered: r2(x.recovered), bounties: r2(x.bounties) }))
    // Countries first (most sessions first), sessions without a country last.
    .sort((a, b) => (!a.country ? 1 : 0) - (!b.country ? 1 : 0) || b.sessions - a.sessions || a.country.localeCompare(b.country));

  const usHint = list.some((s) => s.country === 'US' || s.withheld?.form === 'W-2G' || s.withheld?.form === '1042-S');
  let us: UsLosses[] | null = null;
  if (usHint) {
    // One row per currency and tax year: a loss in one year never offsets wins in another.
    const by = new Map<string, { currency: string; year: number; wins: number; losses: number; allowed: number }>();
    for (const s of list) {
      const year = new Date(resultAt(s)).getFullYear();
      const key = `${s.currency}|${year}`;
      const x = by.get(key) ?? { currency: s.currency, year, wins: 0, losses: 0, allowed: 0 };
      const g = gamblingResult(s);
      if (g > 0) x.wins += g;
      else {
        x.losses -= g;
        x.allowed -= g * usLossShare(year);
      }
      by.set(key, x);
    }
    const years = new Set([...by.values()].map((x) => x.year)).size;
    us = [...by.values()].sort((a, b) => a.year - b.year || a.currency.localeCompare(b.currency)).map(({ currency, year, ...x }) => {
      const deductible = Math.min(x.allowed, x.wins);
      return { currency, ...(years > 1 ? { year } : null), wins: r2(x.wins), losses: r2(x.losses), deductible: r2(deductible), taxable: r2(x.wins - deductible), lostToCap: r2(Math.min(x.losses, x.wins) - deductible) };
    });
  }

  const pend = new Map<string, number>();
  for (const s of list) if (s.withheld?.status === 'recover' && s.withheld.amount) pend.set(s.currency, (pend.get(s.currency) ?? 0) + s.withheld.amount);
  const exp = new Map<string, TaxReport['expenses'][number]>();
  const bucket = (currency: string) =>
    exp.get(currency) ?? exp.set(currency, { currency, byKind: Object.fromEntries(EXPENSE_KINDS.map((k) => [k, 0])) as Record<ExpenseKind, number>, sessions: 0, total: 0 }).get(currency)!;
  // Each trip expense once, in the year it was paid: a trip over the new year splits between the two.
  // In the trip's currency where the trip has a rate for it, else in its own, never left out.
  for (const { trip } of trips)
    for (const x of trip.expenses) {
      if (!inRange(x.at, range)) continue;
      const v = toTripCurrency(Math.abs(x.amount), x.currency, trip);
      const b = bucket(v === null ? x.currency : trip.currency);
      const k = EXPENSE_KINDS.includes(x.kind) ? x.kind : 'other';
      b.byKind[k] += v ?? Math.abs(x.amount);
      b.total += v ?? Math.abs(x.amount);
    }
  for (const s of list)
    if (s.expenses || s.tips) {
      // Dealer tips count with the expenses typed on sessions.
      const b = bucket(s.currency);
      b.sessions += (s.expenses || 0) + (s.tips || 0);
      b.total += (s.expenses || 0) + (s.tips || 0);
    }
  const expenses = [...exp.values()].map((b) => ({ ...b, sessions: r2(b.sessions), total: r2(b.total), byKind: Object.fromEntries(EXPENSE_KINDS.map((k) => [k, r2(b.byKind[k])])) as Record<ExpenseKind, number> }));
  const sharesIncluded = list.some((s) => soldShare(s) > 0 || !!s.swapNet || !!s.makeupCut);

  return { rows: out, us, pending: [...pend.entries()].map(([currency, amount]) => ({ currency, amount: r2(amount) })), expenses, sharesIncluded };
}
