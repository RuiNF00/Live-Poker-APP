/**
 * Weekly logging streak: weeks in a row with at least one hand, session note
 * or player note. It rewards logging and review, never playing more, so a
 * week without poker can be paused and a missed week can use a freeze.
 */

import { minOf } from '@/lib/extent';

export const FREEZE_EVERY = 4;
export const MAX_FREEZES = 2;
export const MILESTONES = [2, 4, 8, 12, 26, 52, 104];

export type WeekState = 'logged' | 'frozen' | 'paused' | 'empty';

export interface Pause {
  from: number;
  to?: number;
}

export interface Streak {
  /** Weeks in a row, this one included once it has something logged. */
  weeks: number;
  freezes: number;
  loggedThisWeek: boolean;
  paused: boolean;
  next: number;
  /** Oldest first, the current week last. */
  recent: WeekState[];
}

/** Monday 00:00 local time of the week `ts` falls in. */
export function weekStart(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * weekStart for a long list of times. Times next to each other mostly fall in the same week, so
 * one check against the last week found skips the date maths (a Date per hand was most of the
 * home screen's work with years of hands). Same answers as weekStart.
 */
export function weekStarter(): (ts: number) => number {
  let from = 0;
  let to = -Infinity;
  return (ts) => {
    if (ts >= from && ts < to) return from;
    from = weekStart(ts);
    to = nextWeek(from);
    return from;
  };
}

function nextWeek(w: number) {
  // Through setDate, so a daylight-saving change never shifts the boundary.
  const d = new Date(w);
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

/** What counts as logging: a hand (or reviewing one), a session with a note, a player note (by when it was last touched). */
export function streakActivity(hands: { createdAt: number; reviewedAt?: number }[], sessions: { startedAt: number; notes: string }[], players: { updatedAt: number }[]): number[] {
  // Reviewing a hand (answering its «O que fazes aqui?») keeps the week too: practice without playing.
  return [...hands.flatMap((h) => (h.reviewedAt ? [h.createdAt, h.reviewedAt] : [h.createdAt])), ...sessions.filter((x) => x.notes.trim()).map((x) => x.startedAt), ...players.map((p) => p.updatedAt)];
}

export function computeStreak(activity: number[], pauses: Pause[], now: number, recentWeeks = 12): Streak {
  const current = weekStart(now);
  const weeksLogged = activity.map(weekStarter());
  const logged = new Set(weeksLogged);
  const isPaused = (w: number) => {
    const end = nextWeek(w);
    return pauses.some((p) => p.from < end && (p.to ?? Infinity) > w);
  };
  const states: WeekState[] = [];
  let weeks = 0;
  let freezes = 0;
  const first = activity.length ? minOf(weeksLogged) : current;
  for (let w = Math.min(first, current); w <= current; w = nextWeek(w)) {
    let st: WeekState;
    if (logged.has(w)) {
      st = 'logged';
      weeks++;
      if (weeks % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    } else if (isPaused(w)) st = 'paused';
    else if (w === current) st = 'empty';
    else if (weeks > 0 && freezes > 0) {
      st = 'frozen';
      freezes--;
    } else {
      st = 'empty';
      weeks = 0;
    }
    states.push(st);
  }
  while (states.length < recentWeeks) states.unshift('empty');
  return {
    weeks,
    freezes,
    loggedThisWeek: logged.has(current),
    paused: isPaused(current),
    next: MILESTONES.find((m) => m > weeks) ?? weeks + 52,
    recent: states.slice(-recentWeeks),
  };
}

