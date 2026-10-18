// The player's plan for a festival: which events (flights) they'll play, when
// late registration closes for each, and the session started from each one.
// Kept apart from the main store: it's small and per-device; the backup carries it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { t } from '@/i18n';
import { eventDay, eventTitle, venueClock, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';

import { parseOrQuarantine, quarantine } from './boot';
import type { KV } from './persist';
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

/** When late reg closes, in minutes after the start: the player's own time, else the organiser's. */
export function lateRegOf(plan: FestivalPlan, e: FestivalEvent): number | undefined {
  return plan.lateReg[e.id] ?? e.lateRegMin;
}

/** Minutes before the start that the first reminder fires. */
export const REMIND_BEFORE_MIN = 30;
/** Minutes before late reg closes: late enough to still be on time, early enough to get to the cage. */
export const LATE_REMIND_BEFORE_MIN = 20;

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

/** The number for the next added tournament: one past the highest, so a deleted one's number is never reused (it would link sessions). */
export function nextOwnNumber(p: FestivalPlan): number {
  return Math.max(0, ...(p.events ?? []).map((e) => e.number - 100_000)) + 1;
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

/**
 * When a session started for this event runs its level clock from: the published start, also when
 * joining in late reg (the floor's clock). Past late reg (or LATE_DEFAULT_MIN when none is given), as
 * when starting a row from an earlier day, the published start says nothing: the clock runs from now.
 */
export function levelStart(f: Festival, e: FestivalEvent, now = Date.now(), lateMin = e.lateRegMin): number | undefined {
  if (!e.levelMinutes) return undefined;
  const start = venueTime(f, e.start);
  return now > start + (lateMin || LATE_DEFAULT_MIN) * 60_000 ? now : start;
}

/** Schedule filters beyond the game: satellites, fast and deep structures, by the event's name or flight. */
export type EventKind = 'sat' | 'turbo' | 'deep';
const KIND_RE: Record<EventKind, RegExp> = { sat: /sat[eé]l[ií]te|satellite/i, turbo: /turbo|hyper/i, deep: /deep|monster/i };

export function isKind(e: FestivalEvent, k: EventKind): boolean {
  return KIND_RE[k].test(`${e.name} ${e.flight ?? ''}`);
}

/** What entering costs: a Day 2 counts its Day 1's buy-in, so a buy-in filter keeps the whole tournament. */
export function entryBuyIn(f: Festival, e: FestivalEvent): number {
  if (!e.day2) return e.buyIn;
  return f.events.find((x) => x.number === e.number && !x.day2)?.buyIn ?? 0;
}

/** Up to three "até X" buy-in caps that split the schedule: its quartiles, below the dearest event. */
export function buyInCaps(f: Festival): number[] {
  const all = [...new Set(f.events.filter((e) => !e.day2 && e.buyIn > 0).map((e) => e.buyIn))].sort((a, b) => a - b);
  if (all.length < 4) return [];
  return [...new Set([0.25, 0.5, 0.75].map((q) => all[Math.floor((all.length - 1) * q)]))];
}

/** How long a planned row keeps the player busy: a Day 2 the whole day, a flight until its late reg closes. */
const DAY2_BUSY_MIN = 10 * 60;

/**
 * Planned events that overlap another planned event, each with the first one it
 * runs into. Flights of the same tournament are alternatives, not a clash.
 */
export function clashes(f: Festival, plan: FestivalPlan): Map<string, FestivalEvent> {
  const list = planned(f, plan).sort((a, b) => venueTime(f, a.start) - venueTime(f, b.start));
  const busy = (e: FestivalEvent) => venueTime(f, e.start) + (e.day2 ? DAY2_BUSY_MIN : lateRegOf(plan, e) || LATE_DEFAULT_MIN) * 60_000;
  const out = new Map<string, FestivalEvent>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (venueTime(f, b.start) >= busy(a)) break;
      if (a.number === b.number && !a.own && !b.own) continue;
      if (!out.has(a.id)) out.set(a.id, b);
      if (!out.has(b.id)) out.set(b.id, a);
    }
  }
  return out;
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

/** Planned buy-ins still to pay: an entry whose session has ended (busted, cashed or bagged) is already out of the bankroll. */
export function buyInsLeft(f: Festival, plan: FestivalPlan, sessions: Session[]): number {
  const ended = new Set(sessions.filter((s) => s.endedAt).map((s) => s.id));
  return planned(f, plan)
    .filter((e) => !e.day2 && !ended.has(plan.sessions[e.id] ?? ''))
    .reduce((a, e) => a + e.buyIn, 0);
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

export function eventAction(f: Festival, plan: FestivalPlan, sessions: Session[], e: FestivalEvent, now = Date.now()): EventAction | null {
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
  // Nothing new starts before the tournament's own day at the venue: weeks ahead, a stray tap would open a session dated now.
  if (venueClock(f, now).toISOString().slice(0, 10) < eventDay(e)) return null;
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
    if (now < start - 2 * 3_600_000 || now > start + (lateRegOf(plan, e) || LATE_DEFAULT_MIN) * 60_000) continue;
    // Its own window decides the timing (it can open late the evening before a 01:00 start).
    const action = eventAction(f, plan, sessions, e, Math.max(now, start));
    if (action && action.kind !== 'view') return { e, start, action };
  }
  return null;
}

/** A Day 2 named after its flights ("2BC") only takes players bagged in those flights. */
function day2Takes(f: Festival, plan: FestivalPlan, e: FestivalEvent, s: Session): boolean {
  const from = e.takes ?? e.flight?.slice(1) ?? '';
  if (!from) return true;
  // After a re-entry every flight played maps to the session: it bagged in the last one.
  const last = f.events.filter((x) => x.number === e.number && !x.day2 && plan.sessions[x.id] === s.id).sort((a, b) => venueTime(f, b.start) - venueTime(f, a.start))[0];
  // "1A" and "1C Low Cost" are flights A and C.
  return !last || from.includes((last.flight ?? '').replace(/^1/, '').split(' ')[0]);
}

/** What can follow a festival session that's ending: the same event again, the next planned one, or its Day 2. */
export interface AfterSession {
  f: Festival;
  e: FestivalEvent;
  /** Late reg is still open until then (the player's or the organiser's time): a re-entry instead of ending. */
  reenterUntil?: number;
  /** The next planned event still to start or still open; `now` when it can start straight away. */
  next?: { e: FestivalEvent; start: number; now: boolean };
  /** For a bagged session: the Day 2 it goes on to, and whether it's in the plan (its reminder is). */
  day2?: { e: FestivalEvent; start: number; planned: boolean };
}

/** Where the session `s` sits in a festival plan, and what can follow it. Null for a session from no plan. */
export function afterSession(festivals: Festival[], plans: Record<string, FestivalPlan>, sessions: Session[], s: Session, now = Date.now()): AfterSession | null {
  for (const base of festivals) {
    const plan = plans[base.id];
    if (!plan) continue;
    const f = withPlanEvents(base, plan);
    // After a re-entry on a later flight, every flight played maps to the session: the last one counts.
    const e = f.events.filter((x) => plan.sessions[x.id] === s.id).sort((a, b) => venueTime(f, b.start) - venueTime(f, a.start))[0];
    if (!e) continue;
    const start = venueTime(f, e.start);
    const late = e.day2 ? undefined : lateRegOf(plan, e);
    const closes = late ? start + late * 60_000 : 0;
    const out: AfterSession = { f, e, reenterUntil: !isBagged(s) && now < closes ? closes : undefined };
    if (isBagged(s)) {
      const d2 = f.events.filter((x) => x.number === e.number && x.day2 && venueTime(f, x.start) > now && day2Takes(f, plan, x, s)).sort((a, b) => venueTime(f, a.start) - venueTime(f, b.start))[0];
      if (d2) out.day2 = { e: d2, start: venueTime(f, d2.start), planned: plan.picked.includes(d2.id) };
      return out;
    }
    // As if this session had ended: a later flight of the same event becomes a re-entry.
    const ended = sessions.map((x) => (x.id === s.id ? { ...x, endedAt: x.endedAt ?? now } : x));
    for (const x of planned(f, plan).sort((a, b) => venueTime(f, a.start) - venueTime(f, b.start))) {
      const at = venueTime(f, x.start);
      if (x.id === e.id || now > at + (lateRegOf(plan, x) || LATE_DEFAULT_MIN) * 60_000) continue;
      const a = eventAction(f, plan, ended, x, Math.max(now, at));
      if (!a || a.kind === 'view') continue;
      out.next = { e: x, start: at, now: now >= at - 2 * 3_600_000 };
      break;
    }
    return out;
  }
  return null;
}

export interface PlanReminder {
  id: string;
  /** Opens the planner on this event (its "Começar sessão"). */
  url: string;
  at: number;
  title: string;
  body: string;
}

/** Venue wall-clock HH:MM of an instant. */
export function venueHm(f: Festival, ms: number): string {
  const x = venueClock(f, ms);
  return `${String(x.getUTCHours()).padStart(2, '0')}:${String(x.getUTCMinutes()).padStart(2, '0')}`;
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
    // Day 2 has no registration to miss; nor does an event the player is already in.
    const late = e.day2 || plan.sessions[e.id] ? 0 : lateRegOf(plan, e);
    if (late) {
      const closes = start + late * 60_000;
      out.push({
        id: `${f.id}:${e.id}:late`,
        url,
        at: closes - LATE_REMIND_BEFORE_MIN * 60_000,
        title: t('Registo do {event} fecha às {time}', { event: name, time: venueHm(f, closes) }),
        body: t('Ainda dá para entrar. Toca para começar a sessão.'),
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

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNumbers = (v: unknown) => isRecord(v) && Object.values(v).every((x) => typeof x === 'number');
const isStrings = (v: unknown) => isRecord(v) && Object.values(v).every((x) => typeof x === 'string');

/** The stored plans that have the right shape (fields left out take their empty value); the rest are dropped. */
export function cleanPlans(saved: Record<string, unknown>): Plans {
  const out: Plans = {};
  for (const [id, p] of Object.entries(saved)) {
    if (!isRecord(p)) continue;
    const { picked = [], lateReg = {}, sessions = {}, name, events } = p;
    if (!Array.isArray(picked) || !picked.every((x) => typeof x === 'string')) continue;
    if (!isNumbers(lateReg) || !isStrings(sessions)) continue;
    if (name !== undefined && typeof name !== 'string') continue;
    if (events !== undefined && !(Array.isArray(events) && events.every((e) => isRecord(e) && typeof e.id === 'string' && typeof e.start === 'string' && typeof e.name === 'string'))) continue;
    out[id] = { ...(p as unknown as FestivalPlan), picked, lateReg: lateReg as FestivalPlan['lateReg'], sessions: sessions as FestivalPlan['sessions'] };
  }
  return out;
}

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then(async (raw) => {
      const kv = AsyncStorage as unknown as KV;
      const saved = raw ? await parseOrQuarantine<Record<string, unknown>>(kv, KEY, raw, isRecord) : null;
      if (!saved) return;
      const good = cleanPlans(saved);
      // One plan of the wrong shape would break the festival screen on every open: the stored
      // value goes to quarantine as it was, and the good plans are kept.
      if (Object.keys(good).length < Object.keys(saved).length) {
        await quarantine(kv, [[KEY, raw!]]);
        await AsyncStorage.setItem(KEY, JSON.stringify(good)).catch(() => {});
      }
      plans = { ...good, ...plans };
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

/** Reads the phone's plans; the app waits for it at launch so a backup never goes out without them. */
export const loadPlans = (): Promise<void> => load();

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
export async function importPlans(raw: Plans): Promise<void> {
  // A backup is outside data too: a plan of the wrong shape stays out.
  const incoming = isRecord(raw) ? cleanPlans(raw) : {};
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
