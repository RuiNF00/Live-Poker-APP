// Festivals the player adds themselves ("Adicionar o meu festival"): the series
// we don't ship. Name, city, dates and currency only, no schedule. They sit in
// the planner next to the shipped ones, make trips the same way and count as
// "a festival is on". Kept on the phone like the festival plans, and in the backup.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { festivalSortKey, festivalSpan, type Festival } from '@/poker/festivals';

import { parseOrQuarantine } from './boot';
import type { KV } from './persist';

export interface OwnFestivalInput {
  name: string;
  city: string;
  currency: string;
  /** 'YYYY-MM-DD', local days. */
  from: string;
  to: string;
}

/** 'YYYY-MM-DD' of a local timestamp. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** What the form checks before saving: a name and an end on or after the start. */
export function ownFestivalOk(x: OwnFestivalInput): boolean {
  return !!x.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(x.from) && /^\d{4}-\d{2}-\d{2}$/.test(x.to) && x.to >= x.from;
}

/** The phone's time zone ('Europe/Lisbon'), when the engine knows it. */
function phoneZone(): string | undefined {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return z && /^[A-Za-z_]+\/[\w/+-]+$/.test(z) ? z : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The festival record. Times are the phone's: the player is where the festival is.
 * The offset is the phone's on the festival's first day, not on the day it was
 * added, so reminders stay right across a summer-time change.
 */
export function ownFestival(id: string, x: OwnFestivalInput, now = Date.now()): Festival {
  const city = x.city.trim();
  return {
    id,
    name: x.name.trim().slice(0, 60),
    venue: city,
    city: '',
    currency: x.currency,
    utcOffset: -new Date(x.from + 'T12:00:00').getTimezoneOffset(),
    ...(phoneZone() ? { tz: phoneZone() } : {}),
    source: { label: '', checked: dayKey(now) },
    notes: [],
    events: [],
    dates: { from: x.from, to: x.to },
    own: true,
  };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const KEY = 'rl.myFestivals.v1';

let mine: Festival[] = [];
/** The shipped schedules: empty until load() brings them in (the app waits for it at launch). */
let shipped: Festival[] = [];
const byStart = (l: Festival[]) => [...l].sort((a, b) => festivalSortKey(a).localeCompare(festivalSortKey(b)));
let all: Festival[] = [];
let ownRead: Promise<void> | null = null;
let dataRead: Promise<void> | null = null;
let loaded: Promise<void> | null = null;
let ready = false;
const listeners = new Set<() => void>();

function set(next: Festival[]) {
  mine = next;
  all = byStart([...shipped, ...mine]);
  for (const l of listeners) l();
}

function load(): Promise<void> {
  ownRead ??= AsyncStorage.getItem(KEY)
    .then(async (raw) => ((raw && (await parseOrQuarantine<Festival[]>(AsyncStorage as unknown as KV, KEY, raw, Array.isArray))) || []).filter((f) => f && f.own && f.dates))
    .catch(() => [] as Festival[])
    .then((saved) => set([...saved.filter((f) => !mine.some((x) => x.id === f.id)), ...mine]));
  // The schedules (~70 KB) stay out of the launch bundle: their own chunk, read next to the player's list.
  // If it doesn't come (web, offline), the next read tries again and the screens update when it does.
  dataRead ??= import('../poker/festival-data').then(
    (m) => {
      shipped = m.FESTIVALS;
      set(mine);
    },
    () => {
      dataRead = null;
    },
  );
  loaded ??= Promise.all([ownRead, dataRead]).then(() => {
    ready = true;
    set(mine);
  });
  return loaded;
}

function subscribe(l: () => void) {
  void load();
  listeners.add(l);
  return () => listeners.delete(l);
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(mine)).catch(() => {});
}

/** Not over yet on `today` ('YYYY-MM-DD'): running, coming, or with no dates out. */
export function notOver(f: Festival, today: string): boolean {
  const span = festivalSpan(f);
  return span ? span.to >= today : !f.month || f.month >= today.slice(0, 7);
}

/** On now, or starting within `days` of `today`: only festivals with dates (a month-only one is never "soon"). */
export function soon(f: Festival, today: string, days = 7): boolean {
  const span = festivalSpan(f);
  if (!span || span.to < today) return false;
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return span.from <= dayKey(d.getTime());
}

/** Shipped festivals and the player's own, by when they start. */
export function allFestivals(): Festival[] {
  void load();
  return all;
}

export function festivalById(id: string | undefined): Festival | undefined {
  return id ? allFestivals().find((f) => f.id === id) : undefined;
}

export function saveOwnFestival(f: Festival) {
  set([...mine.filter((x) => x.id !== f.id), f]);
  persist();
}

/** The festivals that ship with the app, without the player's own. */
export function shippedFestivals(): Festival[] {
  void load();
  return shipped;
}

/** Reads the shipped schedules and the player's own festivals; the app waits for it at launch (see store.tsx). */
export const loadOwnFestivals = (): Promise<void> => load();

/** The player's own festivals, for the backup. */
export function currentOwnFestivals(): Festival[] {
  void load();
  return mine;
}

/** A backup's own festivals that this phone doesn't have yet; the phone's copy of the rest stays. */
export async function importOwnFestivals(incoming: Festival[]): Promise<void> {
  if (!incoming.length) return;
  await load();
  const add = incoming.filter((f) => !mine.some((x) => x.id === f.id));
  if (!add.length) return;
  set([...mine, ...add]);
  persist();
}

export function deleteOwnFestival(id: string) {
  set(mine.filter((x) => x.id !== id));
  persist();
}

/** Delete all my data: the stored list is already gone, forget the one in memory. */
export function clearOwnFestivals() {
  set([]);
}

export function useFestivals(): Festival[] {
  return useSyncExternalStore(subscribe, allFestivals, allFestivals);
}

/** False until the player's own festivals are read from the phone: an id not found yet may still be one of them. */
export function useFestivalsReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}
