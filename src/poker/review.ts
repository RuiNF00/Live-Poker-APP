// "Rever": a hand is waiting for review (marked by hand, tagged "Rever" at the
// table, filed in a study folder like "Rever com coach", or sent to a coach
// through a coaching link) until you mark it reviewed.
// The note is what you took from it; like folders, it never leaves the phone.

import type { Hand } from './types';

/** Folders whose name says "review" put their hands in the review queue. */
export function isReviewFolder(name: string): boolean {
  return /^\s*(rever|review)/i.test(name);
}

/** The default tag a player taps at the table to come back to a hand (poker/types DEFAULT_TAGS). */
export const REVIEW_TAG = 'Rever';

/** `sentToCoach`: ids of hands in a coaching link (lib/coach-api), which count as waiting too. */
export function needsReview(h: Hand, sentToCoach?: ReadonlySet<string>): boolean {
  if (h.review === 'reviewed') return false;
  return h.review === 'pending' || h.tags.includes(REVIEW_TAG) || !!h.folders?.some(isReviewFolder) || !!sentToCoach?.has(h.id);
}

export function markPending(h: Hand): Hand {
  return { ...h, review: 'pending', reviewedAt: undefined };
}

export function markReviewed(h: Hand, note?: string, now = Date.now()): Hand {
  const n = (note ?? h.reviewNote ?? '').trim();
  return { ...h, review: 'reviewed', reviewedAt: now, reviewNote: n || undefined };
}

/** Takes the hand out of the queue without calling it reviewed. */
export function clearReview(h: Hand): Hand {
  return { ...h, review: undefined, reviewedAt: undefined, tags: h.tags.filter((x) => x !== REVIEW_TAG), folders: h.folders?.filter((f) => !isReviewFolder(f)) };
}

/** Filing a hand into a folder: a review folder puts it (back) in the queue. */
export function fileInFolder(h: Hand, folder: string, on: boolean): Hand {
  const folders = on ? [...new Set([...(h.folders ?? []), folder])] : (h.folders ?? []).filter((x) => x !== folder);
  const next = { ...h, folders };
  return on && isReviewFolder(folder) ? markPending(next) : next;
}

/**
 * The hands waiting for review, oldest first: those of one session (the end-of-session
 * "Rever agora?") or all of them (the Sunday notice, the "Por rever" list).
 */
export function reviewQueue(hands: readonly Hand[], sessionId?: string, sentToCoach?: ReadonlySet<string>): Hand[] {
  return hands.filter((h) => (!sessionId || h.sessionId === sessionId) && needsReview(h, sentToCoach)).sort((a, b) => a.createdAt - b.createdAt);
}

