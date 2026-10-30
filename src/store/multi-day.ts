// Tournaments that last more than one day stay ONE session, so the result,
// the buy-in and the tournament count are all counted once:
// - bagging ends the day: the session is set aside (endedAt) with the bagged
//   stack, which frees the player to start other sessions;
// - Day 2 picks the same session back up with that stack, and the night in
//   between counts as a break, not as time played;
// - busting a flight and entering a later one (1A, then 1B) is a re-entry on
//   the same session.
// While bagged the session reads as a loss of its buy-in, which is the money
// actually out; it settles when the last day ends.

import { MTT_LEVELS } from '@/poker/factory';
import { syncTo } from '@/poker/tourney';

import { bountiesOf } from './session-math';
import type { Session } from './types';

export function isBagged(s: Session): boolean {
  return !!s.bag && !!s.endedAt;
}

/** The day the session is on (or was on when it was bagged), 1-based. */
export function dayOf(s: Session): number {
  return s.day ?? 1;
}

/** End the day with `stack` in the bag. */
export function bagDay(s: Session, stack: number, now = Date.now()): Session {
  return {
    ...s,
    stack,
    stackLog: [...s.stackLog, { t: now, stack, level: s.level }],
    endedAt: now,
    breaks: (s.breaks ?? []).map((b) => (b.end ? b : { ...b, end: now })),
    bag: { stack, at: now },
  };
}

/** Start the next day with the bagged stack; `levelFrom`: the level clock runs from the day's published start (the floor's clock). */
export function resumeDay(s: Session, now = Date.now(), levelFrom = now): Session {
  if (!s.bag) return s;
  const { bag, ...rest } = s;
  return {
    ...rest,
    endedAt: undefined,
    day: dayOf(s) + 1,
    stack: bag.stack,
    stackLog: [...s.stackLog, { t: now, stack: bag.stack, level: s.level }],
    // Joined after the day started: the night ends there, so the clock doesn't count the minutes missed as a pause.
    breaks: [...(s.breaks ?? []), { start: bag.at, end: Math.max(bag.at, Math.min(now, levelFrom)) }],
    levelStartedAt: s.levelMinutes ? levelFrom : undefined,
  };
}

/** The new flight's published start, when the festival knows it: level 1 runs from there, with its stack. */
export type FlightStart = { levelStartedAt?: number; stack?: number; levelMinutes?: number };

/**
 * Busted earlier: enter a later flight of the same event on the same session. The new flight
 * starts again at level 1 with a starting stack; bounties already won stay won.
 */
export function reenterFlight(s: Session, name: string, now = Date.now(), start: FlightStart = {}): Session {
  const startStack = start.stack ?? s.tourney?.startStack ?? s.stackLog[0]?.stack ?? s.stack;
  const out = s.endedAt ?? now;
  const levelMinutes = start.levelMinutes ?? s.levelMinutes;
  // Level 1 of the structure when there is one, else the app's first level, as a new session starts.
  const [sb, bb] = MTT_LEVELS[0];
  const level1 = s.tourney?.structure?.length
    ? syncTo(s.tourney.structure, 1, undefined, now)
    : { sb, bb, ante: s.anteType === 'none' ? 0 : bb, level: 1, levelMinutes, levelStartedAt: levelMinutes ? now : undefined };
  return {
    ...s,
    ...level1,
    ...(start.levelStartedAt !== undefined && level1.levelMinutes ? { levelStartedAt: start.levelStartedAt } : null),
    stage: 'early',
    name,
    endedAt: undefined,
    bag: undefined,
    day: undefined,
    entries: s.entries + 1,
    // A PKO flight busted with bounties: that money was paid out, it stays in the prize.
    // bountiesOf, like the planner's check: never more than the prize the session had, nor NaN from an old backup.
    cashOut: bountiesOf(s),
    finish: undefined,
    field: undefined,
    stack: startStack,
    stackLog: [...s.stackLog, { t: now, stack: startStack, level: 1 }],
    breaks: [...(s.breaks ?? []), { start: out, end: now }],
    // Players left was the busted flight's count.
    ...(s.tourney ? { tourney: { ...s.tourney, left: undefined } } : null),
  };
}
