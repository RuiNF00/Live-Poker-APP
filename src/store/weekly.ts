// The player's own weekly tournaments ("Repetir todas as semanas"): the
// Thursday game at their casino, typed once. Each week on its day it shows in
// the Sessão tab's "today" chips and fills the form in one tap. No outside
// data: the name and venue are the player's. Kept on the phone like the
// festival plans, and in the backup.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { mergeById } from './backup';
import { parseOrQuarantine } from './boot';
import { markDeleted } from './deleted';
import { alive, type Deleted } from './deleted-math';
import type { KV } from './persist';
import type { Session } from './types';

export interface WeeklyTournament {
  id: string;
  name: string;
  venue: string;
  currency: string;
  /** 0 = Sunday, as Date.getDay(). */
  weekday: number;
  /** 'HH:MM', the phone's clock. */
  time: string;
  buyIn: number;
  stack?: number;
  levelMinutes?: number;
  /** Last saved: an edit after another phone's delete wins (deleted-math.ts). */
  updatedAt?: number;
}

/** The weekly tournament a live session repeats, from the form as it is and its start time. */
export function weeklyFrom(id: string, s: Session, time: string, now = Date.now()): WeeklyTournament {
  return {
    id,
    name: s.name.trim().slice(0, 60),
    venue: s.venue.trim(),
    currency: s.currency,
    weekday: new Date(now).getDay(),
    time,
    buyIn: s.buyIn,
    stack: s.stack || undefined,
    levelMinutes: s.levelMinutes || undefined,
  };
}

/** The one this form is (same name and buy-in, on today's weekday), if any. */
export function weeklyMatch(list: WeeklyTournament[], s: Pick<Session, 'name' | 'buyIn'>, now = Date.now()): WeeklyTournament | undefined {
  const wd = new Date(now).getDay();
  return list.find((w) => w.weekday === wd && w.name === s.name.trim() && w.buyIn === s.buyIn);
}

/** Today's, by time. */
export function weeklyToday(list: WeeklyTournament[], now = Date.now()): WeeklyTournament[] {
  const wd = new Date(now).getDay();
  return list.filter((w) => w.weekday === wd).sort((a, b) => a.time.localeCompare(b.time));
}

/** Epoch ms of `time` today on the phone's clock. */
export function todayAt(time: string, now = Date.now()): number {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** Level 1 runs from the start time, or from now when that's past (as a festival event's does). */
export function weeklyLevelStart(w: WeeklyTournament, now = Date.now()): number | undefined {
  return w.levelMinutes ? Math.max(now, todayAt(w.time, now)) : undefined;
}

/** "21:00" from now, down to the half hour: a weekly game starts on the hour or the half. */
export function roundedClock(now = Date.now()): string {
  const d = new Date(now);
  return `${String(d.getHours()).padStart(2, '0')}:${d.getMinutes() < 30 ? '00' : '30'}`;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const KEY = 'rl.weekly.v1';

let list: WeeklyTournament[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: WeeklyTournament[]) {
  list = next;
  for (const l of listeners) l();
}

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then(async (raw) => {
      const saved = (raw && (await parseOrQuarantine<WeeklyTournament[]>(AsyncStorage as unknown as KV, KEY, raw, Array.isArray))) || [];
      set([...saved.filter((w) => !list.some((x) => x.id === w.id)), ...list]);
    })
    .catch(() => {});
  return loaded;
}

function subscribe(l: () => void) {
  void load();
  listeners.add(l);
  return () => listeners.delete(l);
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
}

export function useWeekly(): WeeklyTournament[] {
  return useSyncExternalStore(
    subscribe,
    () => list,
    () => list,
  );
}

/** Saves it, replacing one with the same name and buy-in on the same day. */
export function saveWeekly(w: WeeklyTournament, now = Date.now()) {
  const same = (x: WeeklyTournament) => x.id !== w.id && x.weekday === w.weekday && x.name === w.name && x.buyIn === w.buyIn;
  // The one it replaces is deleted, or the other phone's copy brings it back as a twin.
  markDeleted('weekly', list.filter(same).map((x) => x.id), now);
  set([...list.filter((x) => x.id !== w.id && !same(x)), { ...w, updatedAt: now }]);
  persist();
}

export function deleteWeekly(id: string) {
  markDeleted('weekly', [id]);
  set(list.filter((x) => x.id !== id));
  persist();
}

/** Reads the weekly tournaments; the app waits for it at launch (see store.tsx). */
export const loadWeekly = (): Promise<void> => load();

/** Every weekly tournament, for the backup. */
export function currentWeekly(): WeeklyTournament[] {
  void load();
  return list;
}

/**
 * A backup's weekly tournaments joined in (by id, the later save of each; with no save times the phone's copy
 * stays), less what either phone deleted after its last save (`deleted`, both phones' deletes).
 */
export async function importWeekly(incoming: WeeklyTournament[], deleted: Deleted = {}): Promise<void> {
  await load();
  const next = alive(mergeById(list, incoming).list, 'weekly', deleted);
  if (next.length === list.length && next.every((w, i) => w === list[i])) return;
  set(next);
  persist();
}

/** Delete all my data: the stored list is already gone, forget the one in memory. */
export function clearWeekly() {
  set([]);
}
