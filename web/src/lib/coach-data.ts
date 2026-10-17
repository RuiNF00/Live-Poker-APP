// Shapes and input checks for private coaching links, shared by the API, the page and its tests.

export type Mark = 'good' | 'mistake' | 'question';
export const MARKS: Mark[] = ['good', 'mistake', 'question'];

export interface CoachComment {
  id: string;
  handId: string;
  /** Replay step the comment is about (street or action); null for the whole hand. */
  stepIndex: number | null;
  mark: Mark | null;
  author: 'coach' | 'player';
  name: string;
  body: string;
  createdAt: string;
}

export interface CoachLinkView {
  title: string;
  player: string;
  expiresAt: string | null;
  createdAt: string;
  hands: { id: string; payload: unknown }[];
  comments: CoachComment[];
}

export interface NewCoachComment {
  handId: string;
  stepIndex: number | null;
  mark: Mark | null;
  name: string;
  body: string;
  /** The sender's own id for this comment, so a retried post returns it instead of a copy. */
  key?: string | null;
}

export const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const MAX_HANDS = 50;
/** 128 random bits in hex: the link's only secret. */
export const TOKEN_RE = /^[a-f0-9]{32}$/;
export const OWNER_RE = /^[a-f0-9]{64}$/;
export const HAND_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n) : '');

/** A comment as the coach's page (or the player's app) sends it; null when it isn't one. */
export function parseComment(x: unknown, withMark = true): NewCoachComment | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const handId = typeof o.handId === 'string' && HAND_ID_RE.test(o.handId) ? o.handId : null;
  const name = str(o.name, 40);
  const body = str(o.body, 2000);
  if (!handId || !name || !body) return null;
  const step = typeof o.stepIndex === 'number' && Number.isInteger(o.stepIndex) && o.stepIndex >= 0 && o.stepIndex <= 1000 ? o.stepIndex : null;
  const mark = withMark && MARKS.includes(o.mark as Mark) ? (o.mark as Mark) : null;
  const key = typeof o.key === 'string' && KEY_RE.test(o.key) ? o.key : null;
  return { handId, stepIndex: step, mark, name, body, key };
}

/** Days until the link closes: 1 to 365, or null for no expiry. */
export function expiryFrom(days: unknown, now = Date.now()): string | null {
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) return null;
  return new Date(now + Math.min(365, Math.max(1, Math.round(days))) * 86400000).toISOString();
}

/**
 * Second line of defence behind the app's publicHand(): private fields never reach the coach even if a
 * client sends them. Names follow the player's sharing setting and notes are a choice on the send screen,
 * so both stay as sent.
 */
export function stripPrivate(hand: unknown): unknown {
  if (!hand || typeof hand !== 'object' || Array.isArray(hand)) return hand;
  const { sessionId: _s, shareId: _i, shareToken: _t, voiceNote: _v, folders: _f, ...rest } = hand as Record<string, unknown>;
  if (Array.isArray(rest.players)) {
    rest.players = rest.players.map((p) => {
      if (!p || typeof p !== 'object') return p;
      const { playerId: _p, ...q } = p as Record<string, unknown>;
      return q;
    });
  }
  return rest;
}

/** Biggest request the coach API reads: 50 hands of 64 KB, plus room. Comments are far smaller. */
export const MAX_CREATE_BYTES = 3_500_000;
export const MAX_COMMENT_BYTES = 16_000;

/** True when the declared body is too big to read. */
export function tooBig(req: Request, max: number): boolean {
  const n = Number(req.headers.get('content-length') ?? 0);
  return Number.isFinite(n) && n > max;
}
