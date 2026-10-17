// The player's plan for a festival: which events (flights) they'll play, when
// late registration closes for each, and the session started from each one.
// Kept apart from the main store: it's small and per-device; the backup carries it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { t } from '@/i18n';
import { eventTitle, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';

import { isBagged } from './multi-day';
import type { Session } from './types';

export interface FestivalPlan {
  /** Event ids (see FestivalEvent.id) the player plans to play. */
  picked: string[];
  /** Late registration closes this many minutes after the start (the player enters it). */
  lateReg: Record<string, number>;
  /** Session started from an event. */
  sessions: Record<string, string>;
  /** The player's own name for the festival, replacing the shipped generic one. */
  name?: string;
  /** Tournaments the player added: ones the schedule doesn't have, or a festival with no schedule yet. */
  events?: FestivalEvent[];
}

export const EMPTY_PLAN: FestivalPlan = { picked: [], lateReg: {}, sessions: {} };

/** Minutes before the start, and before late reg closes, that the reminders fire. */
export const REMIND_BEFORE_MIN = 30;

/** The festival with the player's added tournaments in its schedule, by start. Safe to call twice. */
export function withPlanEvents(f: Festival, plan: FestivalPlan): Festival {
  const have = new Set(f.events.map((e) => e.id));
  const add = (plan.events ?? []).filter((e) => !have.has(e.id));
  return add.length ? { ...f, events: [...f.events, ...add].sort((a, b) => a.start.localeCompare(b.start)) } : f;
}

export interface OwnEventInput {
  name: string;
  /** 'YYYY-MM-DDTHH:MM', venue wall clock. */
  start: string;
  game: FestivalEvent['game'];
  buyIn: number;
  stack?: number;
  levelMinutes?: number;
}

/** A tournament the player adds; its own number, so it never joins a schedule event's flights. */
export function ownEvent(id: string, x: OwnEventInput, n: number): FestivalEvent {
  return { id, number: 100_000 + n, name: x.name.trim(), unnumbered: true, game: x.game, buyIn: x.buyIn, guarantee: 0, start: x.start, stack: x.stack || undefined, levelMinutes: x.levelMinutes || undefined, own: true };
}

/** Takes an added tournament out of the plan, with its reminders' late reg; a session already played keeps its data. */
export function removeOwnEvent(p: FestivalPlan, id: string): FestivalPlan {
  const lateReg = { ...p.lateReg };
  delete lateReg[id];
  return { ...p, events: (p.events ?? []).filter((e) => e.id !== id), picked: p.picked.filter((x) => x !== id), lateReg };
}

export function planned(f: Festival, plan: FestivalPlan): FestivalEvent[] {
  const set = new Set(plan.picked);
  return withPlanEvents(f, plan).events.filter((e) => set.has(e.id));
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

/**
 * What a planned row's button does. One tournament is one session across its
 * flights and days: a Day 2 picks up the bagged session, a later flight after
 * busting is a re-entry on it.
 */
export type EventAction =
  | { kind: 'start' }
  | { kind: 'view'; session: Session }
  | { kind: 'resume'; session: Session }
  | { kind: 'reenter'; session: Session };

export function eventAction(f: Festival, plan: FestivalPlan, sessions: Session[], e: FestivalEvent): EventAction | null {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const own = byId.get(plan.sessions[e.id] ?? '');
  if (own && !own.endedAt) return { kind: 'view', session: own };
  // The session this event already has, on any of its rows.
  const linked = f.events
    .filter((x) => x.number === e.number)
    .map((x) => byId.get(plan.sessions[x.id] ?? ''))
    .filter((s): s is Session => !!s)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  if (linked && !linked.endedAt) return { kind: 'view', session: linked };
  if (e.day2) return linked && isBagged(linked) && day2Takes(f, plan, e, linked) ? { kind: 'resume', session: linked } : null;
  if (own) return null;
  if (linked && !isBagged(linked) && !linked.cashOut) return { kind: 'reenter', session: linked };
  return linked && isBagged(linked) ? null : { kind: 'start' };
}

/** How long after the start a planned event still offers a session when the player gave no late reg. */
export const LATE_DEFAULT_MIN = 4 * 60;

/**
 * The planned event to start right now, if any: from 2 h before its start
 * until late reg closes. The earliest such event that still has something to
 * start (not running already, not a Day 2 nobody bagged for).
 */
export function plannedNow(f: Festival, plan: FestivalPlan, sessions: Session[], now = Date.now()): { e: FestivalEvent; start: number; action: EventAction } | null {
  for (const e of planned(f, plan).sort((a, b) => venueTime(f, a.start) - venueTime(f, b.start))) {
    const start = venueTime(f, e.start);
    if (now < start - 2 * 3_600_000 || now > start + (plan.lateReg[e.id] || LATE_DEFAULT_MIN) * 60_000) continue;
    const action = eventAction(f, plan, sessions, e);
    if (action && action.kind !== 'view') return { e, start, action };
  }
  return null;
}

/** A Day 2 named after its flights ("2BC") only takes players bagged in those flights. */
function day2Takes(f: Festival, plan: FestivalPlan, e: FestivalEvent, s: Session): boolean {
  const from = e.flight?.slice(1) ?? '';
  if (!from) return true;
  // After a re-entry every flight played maps to the session: it bagged in the last one.
  const last = f.events.filter((x) => x.number === e.number && !x.day2 && plan.sessions[x.id] === s.id).sort((a, b) => venueTime(f, b.start) - venueTime(f, a.start))[0];
  return !last || from.includes(last.flight ?? '');
}

export interface PlanReminder {
  id: string;
  /** Opens the planner on this event (its "Começar sessão"). */
  url: string;
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
    const url = `sweatbook://festival?id=${encodeURIComponent(f.id)}&event=${encodeURIComponent(e.id)}`;
    out.push({
      id: `${f.id}:${e.id}:start`,
      url,
      at: start - REMIND_BEFORE_MIN * 60_000,
      title: t('Começa daqui a {n} min', { n: REMIND_BEFORE_MIN }),
      body: name,
    });
    const late = plan.lateReg[e.id];
    if (late) {
      out.push({
        id: `${f.id}:${e.id}:late`,
        url,
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
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      plans = { ...JSON.parse(raw), ...plans };
      emit();
    })
    .catch(() => {});
  return loaded;
}

function subscribe(l: () => void) {
  void load();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Delete all my data: the stored plans are already gone, forget the ones in memory. */
export function clearPlans() {
  plans = {};
  emit();
}

/** Every plan, for the backup. Starts reading the phone's copy if nothing has yet. */
export function currentPlans(): Plans {
  void load();
  return plans;
}

/**
 * One festival's plan after a restore: nothing on this phone goes away. Picks
 * and added tournaments are joined; where both set a late reg, a session or a
 * name, this phone's stays.
 */
export function mergePlan(local: FestivalPlan | undefined, incoming: FestivalPlan): FestivalPlan {
  if (!local) return incoming;
  const have = new Set((local.events ?? []).map((e) => e.id));
  const events = [...(local.events ?? []), ...(incoming.events ?? []).filter((e) => !have.has(e.id))];
  return {
    ...incoming,
    ...local,
    picked: [...new Set([...local.picked, ...incoming.picked])],
    lateReg: { ...incoming.lateReg, ...local.lateReg },
    sessions: { ...incoming.sessions, ...local.sessions },
    name: local.name?.trim() ? local.name : incoming.name,
    ...(events.length ? { events } : {}),
  };
}

/** Brings a backup's plans in (see mergePlan), after the phone's own are read so none is written over. */
export async function importPlans(incoming: Plans): Promise<void> {
  const ids = Object.keys(incoming);
  if (!ids.length) return;
  await load();
  const next = { ...plans };
  for (const id of ids) next[id] = mergePlan(plans[id], incoming[id]);
  plans = next;
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(plans)).catch(() => {});
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

/** Every festival's plan, by festival id (the Sessão tab looks across all of them). */
export function useFestivalPlans(): Plans {
  return useSyncExternalStore(
    subscribe,
    () => plans,
    () => plans,
  );
}

/** Same as useFestivalPlans (the swap suggestions use this name). */
export const usePlans = useFestivalPlans;
