// Friction metrics sent with funnel events: how much it took to log a hand and how soon a
// hand was shared. Counts and coarse buckets only, never what was typed or when exactly.

/** How long after saving a hand it was first shared. Buckets, so the time of day can't be read back. */
export function shareDelay(ms: number): string {
  const m = ms / 60_000;
  return m < 1 ? '<1m' : m < 10 ? '1-10m' : m < 60 ? '10-60m' : m < 1440 ? '1-24h' : '>1d';
}

/** Seconds spent on the entry screen, capped at an hour (a hand left open overnight says nothing). */
export function entrySeconds(openedAt: number, now: number): number {
  return Math.max(0, Math.min(3600, Math.round((now - openedAt) / 1000)));
}
