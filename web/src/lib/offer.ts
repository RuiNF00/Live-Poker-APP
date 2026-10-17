import { isOffensive } from './moderation';

/**
 * Festival action packages (sweatbook.poker/o/<id>): the shared contract in
 * pacotes-festival-spec.md. The app builds an Offer and POSTs it; the backer's page sends
 * a reservation. Both are rebuilt here field by field, like live-snapshot.ts: unknown
 * fields are dropped, strings are cut, numbers are rounded to 2 decimals and range checked.
 * Pure (no server-only) so the page and the tests can use it too.
 */

export interface OfferEvent {
  id: string;
  n: string;
  d: number;
  b: number;
  s: number;
}

export interface Offer {
  v: 1;
  player: string;
  title: string;
  cur: string;
  markup: number;
  cap: number;
  min: number;
  whole: boolean;
  events: OfferEvent[];
  closed: boolean;
  at: number;
}

export interface Share {
  e: string;
  p: number;
}

export interface ReservationIn {
  name: string;
  contact: string;
  shares: Share[];
}

export type ReservationStatus = 'pending' | 'confirmed' | 'declined';
export const STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'declined'];

/** Why a reservation was refused, the same words as reserve_action() in SQL. */
export type ReserveError = 'not_found' | 'closed' | 'invalid' | 'over_cap' | 'sold_out' | 'full';

export const MAX_EVENTS = 40;
export const MAX_RESERVATIONS = 200;

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const r = round2(v);
  return r >= min && r <= max ? r : null;
};
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');
const EVENT_ID = /^[A-Za-z0-9-]{1,16}$/;

function parseEvent(x: unknown): OfferEvent | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || !EVENT_ID.test(o.id)) return null;
  const d = typeof o.d === 'number' && Number.isFinite(o.d) && o.d >= 1 && o.d <= 1e13 ? Math.round(o.d) : null;
  const b = num(o.b, 0.01, 1e7);
  const s = num(o.s, 0.01, 100);
  if (d === null || b === null || s === null) return null;
  return { id: o.id, n: str(o.n, 80), d, b, s };
}

/** null when it isn't an offer; 'offensive' when the player or title fails moderation. */
export function parseOffer(x: unknown): Offer | 'offensive' | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || !Array.isArray(o.events) || o.events.length < 1 || o.events.length > MAX_EVENTS) return null;
  const events: OfferEvent[] = [];
  for (const e of o.events) {
    const ev = parseEvent(e);
    if (!ev || events.some((x) => x.id === ev.id)) return null;
    events.push(ev);
  }
  events.sort((a, b) => a.d - b.d);
  const markup = num(o.markup, 1, 2);
  const cap = num(o.cap, 0.5, 100);
  if (markup === null || cap === null) return null;
  const min = o.min === undefined ? Math.min(1, cap) : num(o.min, 0.5, cap);
  if (min === null) return null;
  const offer: Offer = {
    v: 1,
    player: str(o.player, 40),
    title: str(o.title, 60),
    cur: str(o.cur, 4) || '€',
    markup,
    cap,
    min,
    whole: o.whole === true,
    events,
    closed: o.closed === true,
    at: typeof o.at === 'number' && Number.isFinite(o.at) && o.at >= 1 ? Math.round(o.at) : Date.now(),
  };
  if ([offer.player, offer.title, ...events.map((e) => e.n)].some((s) => s && isOffensive(s))) return 'offensive';
  return offer;
}

/**
 * A backer's request, checked for shape against the offer: known events, each once,
 * p ≥ min with 2 decimals, and for a whole package the same p on every event. Pieces of 0
 * are dropped (the per-event form starts at 0). Cap and what is left are checked by the
 * store under its lock (reserveCheck), so those come back as 'over_cap' / 'sold_out'.
 */
export function parseReservation(x: unknown, offer: Offer): ReservationIn | 'offensive' | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const name = str(o.name, 40);
  const contact = str(o.contact, 60);
  if (!name || !Array.isArray(o.shares) || o.shares.length > MAX_EVENTS) return null;
  const shares: Share[] = [];
  for (const s of o.shares) {
    if (!s || typeof s !== 'object') return null;
    const { e, p } = s as { e?: unknown; p?: unknown };
    if (typeof e !== 'string' || typeof p !== 'number' || !Number.isFinite(p)) return null;
    if (!offer.events.some((ev) => ev.id === e) || shares.some((x) => x.e === e)) return null;
    const r = round2(p);
    if (r === 0) continue;
    if (r < offer.min) return null;
    shares.push({ e, p: r });
  }
  if (!shares.length) return null;
  if (offer.whole && (shares.length !== offer.events.length || shares.some((s) => s.p !== shares[0].p))) return null;
  if (isOffensive(name) || (contact && isOffensive(contact))) return 'offensive';
  return { name, contact, shares };
}

/** What a backer pays: Σ p/100 × buy-in × markup. */
export function offerPrice(offer: Offer, shares: Share[]): number {
  let total = 0;
  for (const s of shares) {
    const ev = offer.events.find((e) => e.id === s.e);
    if (ev) total += (s.p / 100) * ev.b * offer.markup;
  }
  return round2(total);
}

/** % still free per event: s minus what pending and confirmed reservations hold. */
export function remaining(offer: Offer, taken: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of offer.events) out[e.id] = Math.max(0, round2(e.s - (taken[e.id] ?? 0)));
  return out;
}

/** Nothing left anywhere for even the smallest piece. */
export function soldOut(offer: Offer, taken: Record<string, number>): boolean {
  const left = remaining(offer, taken);
  return offer.whole ? offer.events.some((e) => left[e.id] < offer.min) : offer.events.every((e) => left[e.id] < offer.min);
}

/**
 * The rules reserve_action() applies in SQL, for the local store: null when it fits.
 * `count` is how many reservations the offer already has (any status).
 */
export function reserveCheck(offer: Offer, taken: Record<string, number>, r: ReservationIn, count: number): ReserveError | null {
  if (offer.closed) return 'closed';
  const ids = new Set<string>();
  for (const s of r.shares) {
    if (!offer.events.some((e) => e.id === s.e) || ids.has(s.e) || s.p !== round2(s.p) || s.p < offer.min) return 'invalid';
    ids.add(s.e);
    if (s.p > offer.cap) return 'over_cap';
  }
  if (!r.shares.length || (offer.whole && (ids.size !== offer.events.length || r.shares.some((s) => s.p !== r.shares[0].p)))) return 'invalid';
  if (count >= MAX_RESERVATIONS) return 'full';
  const left = remaining(offer, taken);
  if (r.shares.some((s) => s.p > (left[s.e] ?? 0) + 1e-9)) return 'sold_out';
  return null;
}

/** Events whose new s would fall below what backers already hold (a removed event offers 0). */
export function updateConflicts(next: Offer, taken: Record<string, number>): string[] {
  return Object.entries(taken)
    .filter(([id, t]) => t > 0 && t > (next.events.find((e) => e.id === id)?.s ?? 0) + 1e-9)
    .map(([id]) => id);
}

/** % held per event by a list of active reservations. */
export function sumTaken(rs: { shares: Share[]; status: ReservationStatus }[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const r of rs) {
    if (r.status === 'declined') continue;
    for (const s of r.shares) t[s.e] = round2((t[s.e] ?? 0) + s.p);
  }
  return t;
}
