import { isOffensive } from './moderation';
import { normalizeCode } from './refcode';

// A player's public profile (/u/<handle>), as the app sends it, rebuilt here field by field:
// anything else in the request is dropped, strings are cut to size and numbers must be
// finite. Nothing is public unless the player picked it in the app; with `hideAmounts`
// no money ever reaches the server, whatever the app sends.

export interface SessionCard {
  id: string;
  kind: 'mtt' | 'cash';
  name: string;
  venue: string;
  /** When it started (ms). */
  date: number;
  hours: number;
  currency: string;
  /** Absent with hideAmounts. */
  buyIn?: number;
  /** Net result in money; absent with hideAmounts. */
  result?: number;
  finish?: number;
  field?: number;
  hands?: number;
}

export interface ProfilePayload {
  v: 1;
  name: string;
  bio: string;
  hideAmounts: boolean;
  /** The player's invite code: following from the profile credits them. */
  ref: string | null;
  /** Shared hand ids, newest first; each checked against its edit token on the way in. */
  hands: string[];
  sessions: SessionCard[];
}

export const MAX_ITEMS = 30;

/** 3 to 20 of a-z 0-9 _ . starting with a letter or digit (same rule as the database). */
export const HANDLE_RE = /^[a-z0-9][a-z0-9_.]{2,19}$/;
const RESERVED = new Set([
  'admin', 'api', 'app', 'apps', 'about', 'help', 'support', 'privacy', 'terms', 'legal', 'settings', 'login',
  'signup', 'sweatbook', 'sweat', 'official', 'staff', 'team', 'mod', 'moderator', 'root', 'null', 'undefined',
  'live', 'demo', 'invite', 'share', 'download', 'pro', 'store', 'www', 'mail', 'poker',
]);

export type HandleProblem = 'invalid' | 'reserved' | 'offensive';

export function normalizeHandle(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/^@/, '').toLowerCase() : '';
}

export function handleProblem(handle: string): HandleProblem | null {
  if (!HANDLE_RE.test(handle) || handle.includes('..')) return 'invalid';
  if (RESERVED.has(handle.replace(/[_.]/g, '')) || RESERVED.has(handle)) return 'reserved';
  if (isOffensive(handle.replace(/[_.]/g, ' '))) return 'offensive';
  return null;
}

const MAX = 1e13;
const num = (v: unknown, min = 0, max = MAX): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const int = (v: unknown, min: number, max: number) => {
  const n = num(v, min, max);
  return n === undefined ? undefined : Math.round(n);
};
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');

function parseSession(x: unknown, hideAmounts: boolean): SessionCard | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.kind !== 'mtt' && o.kind !== 'cash') return null;
  const date = num(o.date, 1);
  const id = str(o.id, 24);
  if (date === undefined || !id) return null;
  const card: SessionCard = {
    id,
    kind: o.kind,
    name: str(o.name, 80),
    venue: str(o.venue, 80),
    date,
    hours: Math.round((num(o.hours, 0, 200) ?? 0) * 10) / 10,
    currency: str(o.currency, 4) || '€',
  };
  const finish = int(o.finish, 1, 100000);
  const field = int(o.field, 1, 100000);
  const hands = int(o.hands, 0, 100000);
  if (finish !== undefined) card.finish = finish;
  if (field !== undefined && (finish === undefined || field >= finish)) card.field = field;
  if (hands) card.hands = hands;
  if (!hideAmounts) {
    const buyIn = num(o.buyIn, 0, 1e9);
    const result = num(o.result, -1e9, 1e10);
    if (buyIn) card.buyIn = buyIn;
    if (result !== undefined) card.result = Math.round(result * 100) / 100;
  }
  return card;
}

/**
 * The profile without its hands (the route adds the ones whose tokens check out).
 * null when it isn't a profile; 'offensive' when visible text fails moderation.
 */
export function parseProfile(x: unknown): Omit<ProfilePayload, 'hands'> | 'offensive' | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const hideAmounts = o.hideAmounts !== false; // private by default
  const sessions = (Array.isArray(o.sessions) ? o.sessions : [])
    .map((s) => parseSession(s, hideAmounts))
    .filter((s): s is SessionCard => !!s)
    .slice(0, MAX_ITEMS);
  const p = {
    v: 1 as const,
    name: str(o.name, 40),
    bio: str(o.bio, 160),
    hideAmounts,
    ref: typeof o.ref === 'string' ? normalizeCode(o.ref) : null,
    sessions,
  };
  const text = [p.name, p.bio, ...sessions.flatMap((s) => [s.name, s.venue])].join('\n');
  return isOffensive(text) ? 'offensive' : p;
}

/** [{ id, token }] from the app, deduplicated and capped; ids in share-id shape only. */
export function parseHandClaims(x: unknown): { id: string; token: string }[] {
  if (!Array.isArray(x)) return [];
  const seen = new Set<string>();
  const out: { id: string; token: string }[] = [];
  for (const e of x) {
    if (!e || typeof e !== 'object') continue;
    const { id, token } = e as Record<string, unknown>;
    if (typeof id !== 'string' || typeof token !== 'string' || !/^[A-Za-z0-9]{3,20}$/.test(id) || token.length > 128) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, token });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
