// Private coaching links, the part that can be tested: what the phone keeps about each link,
// merging the comments that come back, unread counts and the notification text.

export type Mark = 'good' | 'mistake' | 'question';

export interface CoachComment {
  id: string;
  /** Local hand id (the app sends its own ids when it creates the link). */
  handId: string;
  stepIndex: number | null;
  mark: Mark | null;
  author: 'coach' | 'player';
  name: string;
  body: string;
  createdAt: string;
  /** A reply still waiting in the outbox. */
  pending?: boolean;
}

export interface CoachLink {
  token: string;
  ownerToken: string;
  title: string;
  url: string;
  handIds: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  /** Newest comment seen from the server, for `?since=`. */
  lastSync: string | null;
}

export interface CoachState {
  links: CoachLink[];
  /** By link token. */
  comments: Record<string, CoachComment[]>;
  /** Coach comments the player has opened. */
  seen: string[];
}

export const EMPTY_COACH: CoachState = { links: [], comments: {}, seen: [] };

/** rl.coach.v1 as saved: each part kept as it is, an empty one where a part is missing or isn't the right kind. */
export function parseCoachState(x: unknown): CoachState {
  const v = (x && typeof x === 'object' ? x : {}) as Partial<CoachState>;
  return {
    links: Array.isArray(v.links) ? v.links : [],
    comments: v.comments && typeof v.comments === 'object' ? v.comments : {},
    seen: Array.isArray(v.seen) ? v.seen : [],
  };
}
export const EXPIRY_CHOICES = [7, 30, null] as const;
export type ExpiryChoice = (typeof EXPIRY_CHOICES)[number];
export const MAX_COACH_HANDS = 50;
/** The server deletes a link 30 days after it closes; no point asking after that. */
const PURGE_MS = 30 * 86400000;

export type LinkStatus = 'live' | 'expired' | 'revoked';

export function linkStatus(l: Pick<CoachLink, 'expiresAt' | 'revokedAt'>, now = Date.now()): LinkStatus {
  if (l.revokedAt) return 'revoked';
  if (l.expiresAt && Date.parse(l.expiresAt) <= now) return 'expired';
  return 'live';
}

/** Links whose comments can still come back. */
export function syncable(s: CoachState, now = Date.now()): CoachLink[] {
  return s.links.filter((l) => {
    const end = l.revokedAt ?? (l.expiresAt && Date.parse(l.expiresAt) <= now ? l.expiresAt : null);
    return !end || now - Date.parse(end) < PURGE_MS;
  });
}

/** Comments from the server for one link: new ones are added, our own pending replies are replaced. */
export function mergeComments(s: CoachState, token: string, incoming: CoachComment[]): { state: CoachState; fresh: CoachComment[] } {
  const link = s.links.find((l) => l.token === token);
  if (!link) return { state: s, fresh: [] };
  const have = s.comments[token] ?? [];
  const ids = new Set(have.map((c) => c.id));
  const fresh = incoming.filter((c) => !ids.has(c.id) && link.handIds.includes(c.handId));
  // A reply we sent comes back from the server with its real id: drop the local copy.
  const kept = have.filter((c) => !c.pending || !fresh.some((f) => f.author === 'player' && f.handId === c.handId && f.body === c.body));
  const all = [...kept, ...fresh].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const newest = incoming.reduce<string | null>((m, c) => (!m || Date.parse(c.createdAt) > Date.parse(m) ? c.createdAt : m), link.lastSync);
  return {
    state: {
      ...s,
      links: s.links.map((l) => (l.token === token ? { ...l, lastSync: newest } : l)),
      comments: { ...s.comments, [token]: all },
    },
    fresh: fresh.filter((c) => c.author === 'coach'),
  };
}

/** Every comment about one hand, across links, oldest first. */
export function commentsForHand(s: CoachState, handId: string): { link: CoachLink; comment: CoachComment }[] {
  const out: { link: CoachLink; comment: CoachComment }[] = [];
  for (const link of s.links) for (const comment of s.comments[link.token] ?? []) if (comment.handId === handId) out.push({ link, comment });
  return out.sort((a, b) => Date.parse(a.comment.createdAt) - Date.parse(b.comment.createdAt));
}

/** Unread coach comments per hand id. */
export function unreadByHand(s: CoachState): Record<string, number> {
  const seen = new Set(s.seen);
  const out: Record<string, number> = {};
  for (const list of Object.values(s.comments)) for (const c of list) if (c.author === 'coach' && !seen.has(c.id)) out[c.handId] = (out[c.handId] ?? 0) + 1;
  return out;
}

export function unreadForLink(s: CoachState, token: string): number {
  const seen = new Set(s.seen);
  return (s.comments[token] ?? []).filter((c) => c.author === 'coach' && !seen.has(c.id)).length;
}

/** The player opened the hand: its coach comments are read. */
export function markHandSeen(s: CoachState, handId: string): CoachState {
  const add = Object.values(s.comments)
    .flat()
    .filter((c) => c.handId === handId && c.author === 'coach' && !s.seen.includes(c.id))
    .map((c) => c.id);
  return add.length ? { ...s, seen: [...s.seen, ...add] } : s;
}

/** How many different hands got new coach comments: "O teu coach comentou 3 mãos". */
export function handsCommented(fresh: CoachComment[]): number {
  return new Set(fresh.map((c) => c.handId)).size;
}

/** The free plan gets one link to try coaching; Pro has no limit. */
export function canCreateLink(isPro: boolean, freeUsed: boolean): boolean {
  return isPro || !freeUsed;
}

/** Comment ids gone with an erased link stay out of `seen`. */
export function dropLink(s: CoachState, token: string): CoachState {
  const gone = new Set((s.comments[token] ?? []).map((c) => c.id));
  const comments = { ...s.comments };
  delete comments[token];
  return { links: s.links.filter((l) => l.token !== token), comments, seen: s.seen.filter((id) => !gone.has(id)) };
}

/** Untrusted JSON from the server → comments, skipping anything malformed. */
export function parseComments(x: unknown): CoachComment[] {
  const list = (x as { comments?: unknown } | null)?.comments;
  if (!Array.isArray(list)) return [];
  const out: CoachComment[] = [];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.handId !== 'string' || typeof o.body !== 'string' || typeof o.createdAt !== 'string') continue;
    out.push({
      id: o.id,
      handId: o.handId,
      stepIndex: typeof o.stepIndex === 'number' ? o.stepIndex : null,
      mark: o.mark === 'good' || o.mark === 'mistake' || o.mark === 'question' ? o.mark : null,
      author: o.author === 'player' ? 'player' : 'coach',
      name: typeof o.name === 'string' ? o.name.slice(0, 40) : '',
      body: o.body.slice(0, 2000),
      createdAt: o.createdAt,
    });
  }
  return out;
}

export interface EraseJob {
  kind: string;
  payload: { token: string; ownerToken: string };
  key: string;
}

/** "Delete all my data": every link is deleted on the server (through the outbox), not only revoked. */
export function eraseJobs(s: CoachState): EraseJob[] {
  return s.links.map((l) => ({ kind: 'coach-erase', payload: { token: l.token, ownerToken: l.ownerToken }, key: l.token }));
}
