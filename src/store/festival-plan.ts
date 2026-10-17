// The player's plan for a festival: which events (flights) they'll play, when
// late registration closes for each, and the session started from each one.
// Kept apart from the main store: it's small, per-device, and never synced.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { t } from '@/i18n';
import { eventTitle, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';

export interface FestivalPlan {
  /** Event ids (see FestivalEvent.id) the player plans to play. */
  picked: string[];
  /** Late registration closes this many minutes after the start (the player enters it). */
  lateReg: Record<string, number>;
  /** Session started from an event. */
  sessions: Record<string, string>;
  /** The player's own name for the festival, replacing the shipped generic one. */
  name?: string;
}

export const EMPTY_PLAN: FestivalPlan = { picked: [], lateReg: {}, sessions: {} };

/** Minutes before the start, and before late reg closes, that the reminders fire. */
export const REMIND_BEFORE_MIN = 30;

export function planned(f: Festival, plan: FestivalPlan): FestivalEvent[] {
  const set = new Set(plan.picked);
  return f.events.filter((e) => set.has(e.id));
}

/** What the festival is called on screen: the player's name for it, else the shipped one. */
export function festivalName(f: Festival, plan: FestivalPlan): string {
  return plan.name?.trim() || t(f.name);
}

/** Entries (Day 2s don't cost anything) and what they add up to. */
export function planTotals(f: Festival, plan: FestivalPlan) {
  const list = planned(f, plan);
  const buys = list.filter((e) => !e.day2);
  return { events: list.length, entries: buys.length, buyIns: buys.reduce((a, e) => a + e.buyIn, 0) };
}

/** Planned buy-ins as a share of the bankroll: null with no (or a negative) bankroll. */
export function bankrollShare(buyIns: number, balance: number): number | null {
  return balance > 0 ? buyIns / balance : null;
}

export interface PlanReminder {
  id: string;
  at: number;
  title: string;
  body: string;
}

/** Reminders still ahead of `now`: before each planned start, and before late reg closes where the player set it. */
export function planReminders(f: Festival, plan: FestivalPlan, now = Date.now()): PlanReminder[] {
  const out: PlanReminder[] = [];
  for (const e of planned(f, plan)) {
    const start = venueTime(f, e.start);
    const name = eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '');
    out.push({
      id: `${f.id}:${e.id}:start`,
      at: start - REMIND_BEFORE_MIN * 60_000,
      title: t('Começa daqui a {n} min', { n: REMIND_BEFORE_MIN }),
      body: name,
    });
    const late = plan.lateReg[e.id];
    if (late) {
      out.push({
        id: `${f.id}:${e.id}:late`,
        at: start + (late - REMIND_BEFORE_MIN) * 60_000,
        title: t('Late reg fecha daqui a {n} min', { n: REMIND_BEFORE_MIN }),
        body: name,
      });
    }
  }
  return out.filter((r) => r.at > now).sort((a, b) => a.at - b.at);
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const KEY = 'rl.festivalPlans.v1';
type Plans = Record<string, FestivalPlan>;

let plans: Plans = {};
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      plans = { ...JSON.parse(raw), ...plans };
      emit();
    })
    .catch(() => {});
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getPlan(festivalId: string): FestivalPlan {
  return plans[festivalId] ?? EMPTY_PLAN;
}

export function updatePlan(festivalId: string, fn: (p: FestivalPlan) => FestivalPlan) {
  plans = { ...plans, [festivalId]: fn(getPlan(festivalId)) };
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(plans)).catch(() => {});
}

export function togglePicked(p: FestivalPlan, id: string): FestivalPlan {
  return p.picked.includes(id) ? { ...p, picked: p.picked.filter((x) => x !== id) } : { ...p, picked: [...p.picked, id] };
}

export function useFestivalPlan(festivalId: string): FestivalPlan {
  return useSyncExternalStore(
    subscribe,
    () => getPlan(festivalId),
    () => getPlan(festivalId),
  );
}
