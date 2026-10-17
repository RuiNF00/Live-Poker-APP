import { isOffensive } from './moderation';

/**
 * What a backer's live page shows. Sent by the app (src/lib/live-link.ts liveSnapshot) and
 * rebuilt here field by field: anything else in the request is dropped, strings are cut to
 * size and numbers must be finite, so the public page only ever holds these fields.
 */
export interface LiveSnapshot {
  v: 1;
  player: string;
  kind: 'mtt' | 'cash';
  name: string;
  venue: string;
  currency: string;
  startedAt: number;
  endedAt: number | null;
  playedMs: number;
  paused: boolean;
  level: number | null;
  sb: number;
  bb: number;
  ante: number;
  stack: number;
  stackLog: { t: number; stack: number }[];
  buyIn: number;
  entries: number;
  addOn: number;
  invested: number;
  cashOut: number;
  finish: number | null;
  field: number | null;
  stage: string | null;
  sold: number;
  hands: number;
  updatedAt: number;
  /** Set when the page holds the result back (see holdResult): when it will show. Never sent by the app. */
  heldUntil?: number;
}

// The app's StageId values (src/poker/types.ts).
const STAGES = ['early', 'mid', 'bubble', 'itm', 'ft', 'hu'];
// Large enough for ms timestamps and any chip count.
const MAX = 1e13;

const num = (v: unknown, min = 0, max = MAX): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');

/** null when it isn't a snapshot; 'offensive' when a visible name fails moderation. */
export function parseSnapshot(x: unknown): LiveSnapshot | 'offensive' | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || (o.kind !== 'mtt' && o.kind !== 'cash')) return null;
  const startedAt = num(o.startedAt, 1);
  if (startedAt === null) return null;
  const log = Array.isArray(o.stackLog) ? o.stackLog.slice(-120) : [];
  const snap: LiveSnapshot = {
    v: 1,
    player: str(o.player, 40),
    kind: o.kind,
    name: str(o.name, 80),
    venue: str(o.venue, 80),
    currency: str(o.currency, 4) || '€',
    startedAt,
    endedAt: num(o.endedAt, 1),
    playedMs: num(o.playedMs) ?? 0,
    paused: o.paused === true,
    level: num(o.level, 0, 1000),
    sb: num(o.sb) ?? 0,
    bb: num(o.bb) ?? 0,
    ante: num(o.ante) ?? 0,
    stack: num(o.stack) ?? 0,
    stackLog: log
      .map((p) => (p && typeof p === 'object' ? { t: num((p as { t?: unknown }).t), stack: num((p as { stack?: unknown }).stack) } : null))
      .filter((p): p is { t: number; stack: number } => !!p && p.t !== null && p.stack !== null),
    buyIn: num(o.buyIn) ?? 0,
    entries: num(o.entries, 0, 1000) ?? 1,
    addOn: num(o.addOn) ?? 0,
    invested: num(o.invested) ?? 0,
    cashOut: num(o.cashOut) ?? 0,
    finish: num(o.finish, 1, 1e6),
    field: num(o.field, 1, 1e6),
    stage: typeof o.stage === 'string' && STAGES.includes(o.stage) ? o.stage : null,
    sold: num(o.sold, 0, 100) ?? 0,
    hands: num(o.hands, 0, 1e6) ?? 0,
    updatedAt: num(o.updatedAt, 1) ?? Date.now(),
  };
  if ([snap.player, snap.name, snap.venue].some((s) => s && isOffensive(s))) return 'offensive';
  return snap;
}

/** How long after the end the prize stays off the public page and its preview. */
export const RESULT_DELAY_MS = 3600_000;

/**
 * What the public sees: a session that has just ended shows that it ended, but not
 * the prize, place or cash-out until an hour later. Anyone with a forwarded link
 * would otherwise know who just won how much, and where.
 */
export function holdResult(s: LiveSnapshot, now = Date.now()): LiveSnapshot {
  if (!s.endedAt || now - s.endedAt >= RESULT_DELAY_MS) return s;
  return { ...s, cashOut: 0, finish: null, field: null, heldUntil: s.endedAt + RESULT_DELAY_MS };
}
