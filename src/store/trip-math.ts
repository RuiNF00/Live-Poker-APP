// Trips: a festival or a card-room trip, the sessions played during it and
// what it cost to get there. Pure, so it can be tested.
//
// A trip has one currency. Expenses may also be in the currency of `fx`
// (a flight paid at home), converted at the rate the player typed: the app
// works offline, so it never looks rates up.

import { eventDay, type Festival } from '@/poker/festivals';

import { endOfDay, inRange, startOfDay, type DateRange } from './bankroll-math';
import type { FestivalPlan } from './festival-plan';
import { playedMs, profit } from './session-math';
import type { Expense, ExpenseKind, Session, Trip } from './types';

const DAY = 86400000;

export const EXPENSE_KINDS: ExpenseKind[] = ['flight', 'hotel', 'food', 'coaching', 'software', 'other'];

/** Finished sessions started during the trip, oldest first. */
export function tripSessions(trip: Pick<Trip, 'from' | 'to'>, sessions: Session[]): Session[] {
  return sessions.filter((s) => s.endedAt && inRange(s.startedAt, { from: trip.from, to: trip.to })).sort((a, b) => a.startedAt - b.startedAt);
}

/** An amount in the trip's currency; null when it is in a currency the trip has no rate for. */
export function toTripCurrency(amount: number, currency: string, trip: Pick<Trip, 'currency' | 'fx'>): number | null {
  if (currency === trip.currency) return amount;
  if (trip.fx && trip.fx.rate > 0 && currency === trip.fx.currency) return amount / trip.fx.rate;
  return null;
}

export interface TripSummary {
  currency: string;
  days: number;
  sessions: number;
  hours: number;
  /** Poker results (session expenses already in them). */
  poker: number;
  /** Trip expenses. */
  expenses: number;
  byKind: Record<ExpenseKind, number>;
  /** Poker minus expenses. */
  net: number;
  /** Sessions and expenses in a currency with no rate, left out of the totals. */
  skipped: { currency: string; sessions: number; expenses: number }[];
  /** The same totals in the `fx` currency, when the trip has a rate. */
  converted: { currency: string; poker: number; expenses: number; net: number } | null;
}

export function tripSummary(trip: Trip, sessions: Session[]): TripSummary {
  const byKind: Record<ExpenseKind, number> = { flight: 0, hotel: 0, food: 0, coaching: 0, software: 0, other: 0 };
  const skipped = new Map<string, { currency: string; sessions: number; expenses: number }>();
  const skip = (currency: string) => skipped.get(currency) ?? skipped.set(currency, { currency, sessions: 0, expenses: 0 }).get(currency)!;
  let poker = 0;
  let hours = 0;
  let count = 0;
  for (const s of tripSessions(trip, sessions)) {
    const v = toTripCurrency(profit(s), s.currency, trip);
    if (v === null) {
      skip(s.currency).sessions++;
      continue;
    }
    poker += v;
    hours += playedMs(s) / 3600000;
    count++;
  }
  let expenses = 0;
  for (const x of trip.expenses) {
    const v = toTripCurrency(Math.abs(x.amount), x.currency, trip);
    if (v === null) {
      skip(x.currency).expenses++;
      continue;
    }
    expenses += v;
    byKind[x.kind in byKind ? x.kind : 'other'] += v;
  }
  const net = poker - expenses;
  const r = trip.fx && trip.fx.rate > 0 ? trip.fx : null;
  return {
    currency: trip.currency,
    days: Math.max(1, Math.round((endOfDay(trip.to) + 1 - startOfDay(trip.from)) / DAY)),
    sessions: count,
    hours,
    poker,
    expenses,
    byKind,
    net,
    skipped: [...skipped.values()],
    converted: r ? { currency: r.currency, poker: poker * r.rate, expenses: expenses * r.rate, net: net * r.rate } : null,
  };
}

/** Trips that overlap a date range, newest first. */
export function tripsIn(trips: Trip[], range: DateRange): Trip[] {
  return trips.filter((x) => (range.to === undefined || x.from <= range.to) && (range.from === undefined || x.to >= range.from)).sort((a, b) => b.from - a.from);
}

/** The trip the player is on right now, if any. */
export function currentTrip(trips: Trip[], now = Date.now()): Trip | null {
  return trips.filter((x) => inRange(now, { from: x.from, to: x.to })).sort((a, b) => b.from - a.from)[0] ?? null;
}

export function blankTrip(id: string, currency: string, now = Date.now()): Trip {
  return { id, name: '', venue: '', currency, from: startOfDay(now), to: endOfDay(now + 4 * DAY), expenses: [], createdAt: now };
}

export function blankExpense(id: string, kind: ExpenseKind, currency: string, now = Date.now()): Expense {
  return { id, kind, amount: 0, currency, at: now, note: '' };
}

/** "YYYY-MM-DD" as a local day (the player's phone is where the festival is). */
function localDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/**
 * A trip for a festival: from the day before the first planned event to the
 * day after the last one (travel days, and a cash game on arrival), or the
 * whole festival when nothing is planned yet.
 */
export function tripFromFestival(id: string, f: Festival, plan: FestivalPlan, fx?: Trip['fx'], now = Date.now()): Trip {
  const picked = new Set(plan.picked);
  const fromEvents = (picked.size ? f.events.filter((e) => picked.has(e.id)) : f.events).map(eventDay).sort();
  // No schedule yet: the festival's official dates.
  const days = fromEvents.length ? fromEvents : f.dates ? [f.dates.from, f.dates.to] : [new Date(now).toISOString().slice(0, 10)];
  return {
    id,
    name: f.name,
    venue: `${f.venue}, ${f.city.split(',')[0]}`,
    currency: f.currency,
    from: startOfDay(localDay(days[0]) - DAY),
    to: endOfDay(localDay(days[days.length - 1]) + DAY),
    fx,
    festivalId: f.id,
    expenses: [],
    createdAt: now,
  };
}
