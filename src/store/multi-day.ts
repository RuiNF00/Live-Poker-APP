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

/** Busted earlier: enter a later flight of the same event on the same session. */
export function reenterFlight(s: Session, name: string, now = Date.now()): Session {
  const startStack = s.stackLog[0]?.stack ?? s.stack;
  const out = s.endedAt ?? now;
  return {
    ...s,
    name,
    endedAt: undefined,
    bag: undefined,
    day: undefined,
    entries: s.entries + 1,
    cashOut: 0,
    finish: undefined,
    field: undefined,
    stack: startStack,
    stackLog: [...s.stackLog, { t: now, stack: startStack }],
    breaks: [...(s.breaks ?? []), { start: out, end: now }],
    levelStartedAt: undefined,
  };
}
