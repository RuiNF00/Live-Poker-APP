// The public profile (sweatbook.poker/u/<handle>) as this phone builds it: only the
// hands and sessions the player ticked, and no money unless they turned "hide amounts"
// off. Kept free of React Native so it can be tested.

import type { Hand } from '../poker/types';
import { cost, playedMs, profit } from '../store/session-math';
import type { Session } from '../store/types';

/** What the player picked, kept on the phone so the screen can rebuild the profile. */
export interface ProfileDraft {
  name: string;
  bio: string;
  /** On by default: results and buy-ins stay on the phone. */
  hideAmounts: boolean;
  /** Local hand ids (each must have been shared by link). */
  hands: string[];
  /** Local session ids (finished sessions only). */
  sessions: string[];
}

/** A profile this phone created: the token is what lets it edit or delete it. */
export interface ProfileLink {
  handle: string;
  token: string;
  draft: ProfileDraft;
  savedAt: number;
}

export const MAX_ITEMS = 30;
/** Same rule as the server: 3 to 20 of a-z 0-9 _ . starting with a letter or digit. */
export const HANDLE_RE = /^[a-z0-9][a-z0-9_.]{2,19}$/;

export const EMPTY_DRAFT: ProfileDraft = { name: '', bio: '', hideAmounts: true, hands: [], sessions: [] };

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function handleLooksValid(h: string): boolean {
  return HANDLE_RE.test(h) && !h.includes('..');
}

/** Hands that can go on a profile: shared by link (the server checks the token), newest first. */
export function shareableHands(hands: Hand[]): Hand[] {
  return hands.filter((h) => h.shareId && h.shareToken).sort((a, b) => b.createdAt - a.createdAt);
}

/** Finished sessions, newest first. */
export function profileSessions(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.endedAt).sort((a, b) => b.startedAt - a.startedAt);
}

export function sessionCard(s: Session, handCount: number, hideAmounts: boolean) {
  return {
    id: s.id,
    kind: s.kind,
    name: s.name,
    venue: s.venue,
    date: s.startedAt,
    hours: Math.round((playedMs(s) / 3600000) * 10) / 10,
    currency: s.currency,
    ...(s.finish ? { finish: s.finish } : {}),
    ...(s.field ? { field: s.field } : {}),
    ...(handCount ? { hands: handCount } : {}),
    ...(hideAmounts ? {} : { buyIn: cost(s), result: Math.round(profit(s) * 100) / 100 }),
  };
}

/** The request body for POST /api/profiles and PUT /api/profiles/<handle>. */
export function profileBody(draft: ProfileDraft, all: { hands: Hand[]; sessions: Session[] }, ref: string | null) {
  const picked = new Set(draft.sessions);
  const sessions = profileSessions(all.sessions)
    .filter((s) => picked.has(s.id))
    .slice(0, MAX_ITEMS);
  const handsIn = new Map<string, number>();
  for (const h of all.hands) if (h.sessionId) handsIn.set(h.sessionId, (handsIn.get(h.sessionId) ?? 0) + 1);
  const pickedHands = new Set(draft.hands);
  const hands = shareableHands(all.hands)
    .filter((h) => pickedHands.has(h.id))
    .slice(0, MAX_ITEMS)
    .map((h) => ({ id: h.shareId!, token: h.shareToken! }));
  return {
    profile: {
      name: draft.name.trim().slice(0, 40),
      bio: draft.bio.trim().slice(0, 160),
      hideAmounts: draft.hideAmounts,
      ref,
      sessions: sessions.map((s) => sessionCard(s, handsIn.get(s.id) ?? 0, draft.hideAmounts)),
    },
    hands,
  };
}
