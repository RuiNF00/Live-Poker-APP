/**
 * Weekly logging streak: weeks in a row with at least one hand, session note
 * or player note. It rewards logging and review, never playing more, so a
 * week without poker can be paused and a missed week can use a freeze.
 */

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

function nextWeek(w: number) {
  // Through setDate, so a daylight-saving change never shifts the boundary.
  const d = new Date(w);
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

export function computeStreak(activity: number[], pauses: Pause[], now: number, recentWeeks = 12): Streak {
  const current = weekStart(now);
  const logged = new Set(activity.map(weekStart));
  const isPaused = (w: number) => {
    const end = nextWeek(w);
    return pauses.some((p) => p.from < end && (p.to ?? Infinity) > w);
  };
  const states: WeekState[] = [];
  let weeks = 0;
  let freezes = 0;
  const first = activity.length ? Math.min(...activity.map(weekStart)) : current;
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

