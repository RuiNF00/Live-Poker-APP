// Moments of value: when the free plan has just shown what it's worth, the
// home screen offers Pro in those words (one card, never a pop-up). Pure
// picking here; ProMoment shows it.

import type { Session } from '@/store/types';
import { profit } from '@/store/session-math';

const DAY = 86_400_000;
/** Views before a shared hand counts as a moment. */
export const VIEWS_MIN = 10;
/** How long after the session a big win is still news. */
export const WIN_DAYS = 3;

export type Moment =
  | { kind: 'views'; key: string; handId: string; views: number }
  | { kind: 'bigWin'; key: string; sessionId: string; profit: number; currency: string };

/**
 * The most recent finished session, if it's a win and the best so far in its
 * currency (with at least one earlier session to beat). The first ever win counts too.
 */
export function bigWin(sessions: Session[], now: number): Moment | null {
  const done = sessions.filter((s) => s.endedAt);
  if (!done.length) return null;
  const last = done.reduce((a, b) => ((b.endedAt ?? 0) > (a.endedAt ?? 0) ? b : a));
  if (now - (last.endedAt ?? 0) > WIN_DAYS * DAY) return null;
  const p = profit(last);
  if (p <= 0) return null;
  const others = done.filter((s) => s !== last && s.currency === last.currency);
  if (others.some((s) => profit(s) >= p)) return null;
  return { kind: 'bigWin', key: `win:${last.id}`, sessionId: last.id, profit: p, currency: last.currency };
}

/** The shared hand with the most views, once it passes VIEWS_MIN. */
export function viewed(counts: { handId: string; views: number }[]): Moment | null {
  const top = counts.reduce<{ handId: string; views: number } | null>((a, b) => (!a || b.views > a.views ? b : a), null);
  if (!top || top.views < VIEWS_MIN) return null;
  // A new key at every doubling, so 10 → 20 → 40 views can each be news once.
  const step = VIEWS_MIN * 2 ** Math.floor(Math.log2(top.views / VIEWS_MIN));
  return { kind: 'views', key: `views:${top.handId}:${step}`, handId: top.handId, views: top.views };
}

/** The moment to show: a fresh win first, then views; never one already dismissed. */
export function pickMoment(candidates: (Moment | null)[], dismissed: string[]): Moment | null {
  return candidates.find((m): m is Moment => !!m && !dismissed.includes(m.key)) ?? null;
}
