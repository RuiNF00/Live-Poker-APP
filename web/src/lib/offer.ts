import { isOffensive } from './moderation';

/**
 * Festival action packages, store-safe version (pacotes-festival-spec.md v2). The player
 * records a deal already made with one backer they chose; that backer gets a private link
 * (sweatbook.poker/o/<id>) to confirm the agreed piece. Nothing is sold or paid here.
 *
 * The app POSTs an Agreement and it is rebuilt here field by field, like live-snapshot.ts:
 * unknown fields are dropped, strings are cut, numbers are rounded to 2 decimals and range
 * checked. Pure (no server-only) so the page and the tests can use it too.
 */

export interface AgreementEvent {
  id: string;
  n: string;
  d: number;
  b: number;
  /** This backer's agreed % of the event. */
  p: number;
}

export interface Agreement {
  v: 1;
  player: string;
  backer: string;
  title: string;
  cur: string;
  markup: number;
  events: AgreementEvent[];
  at: number;
}

export const MAX_EVENTS = 40;
/** Events are a festival's schedule: nothing dated more than two years ahead (it would dodge the purge). */
export const MAX_AHEAD_MS = 2 * 366 * 864e5;

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const r = round2(v);
  return r >= min && r <= max ? r : null;
};
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');
// Schedule ids ("12", "12-2A", "85-1F Turbo") and the player's own tournaments (uid('fe_'), 17 characters).
const EVENT_ID = /^[A-Za-z0-9_-][A-Za-z0-9 _-]{0,31}$/;

function parseEvent(x: unknown): AgreementEvent | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || !EVENT_ID.test(o.id)) return null;
  const d = typeof o.d === 'number' && Number.isFinite(o.d) && o.d >= 1 && o.d <= Date.now() + MAX_AHEAD_MS ? Math.round(o.d) : null;
  const b = num(o.b, 0.01, 1e7);
  const p = num(o.p, 0.01, 100);
  if (d === null || b === null || p === null) return null;
  return { id: o.id, n: str(o.n, 80), d, b, p };
}

/** null when it isn't an agreement; 'offensive' when a visible name fails moderation. */
export function parseOffer(x: unknown): Agreement | 'offensive' | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || !Array.isArray(o.events) || o.events.length < 1 || o.events.length > MAX_EVENTS) return null;
  const events: AgreementEvent[] = [];
  for (const e of o.events) {
    const ev = parseEvent(e);
    if (!ev || events.some((x) => x.id === ev.id)) return null;
    events.push(ev);
  }
  events.sort((a, b) => a.d - b.d);
  const markup = num(o.markup, 1, 2);
  if (markup === null) return null;
  const a: Agreement = {
    v: 1,
    player: str(o.player, 40),
    backer: str(o.backer, 40),
    title: str(o.title, 60),
    cur: str(o.cur, 4) || '€',
    markup,
    events,
    at: typeof o.at === 'number' && Number.isFinite(o.at) && o.at >= 1 ? Math.round(o.at) : Date.now(),
  };
  if ([a.player, a.backer, a.title, ...events.map((e) => e.n)].some((s) => s && isOffensive(s))) return 'offensive';
  return a;
}

/** The cost of one event's piece: p/100 × buy-in × markup. */
export const eventCost = (a: Agreement, e: AgreementEvent) => round2((e.p / 100) * e.b * a.markup);

/** The cost of the whole piece: Σ p/100 × buy-in × markup. A record, never a payment. */
export function agreementCost(a: Agreement): number {
  return round2(a.events.reduce((t, e) => t + (e.p / 100) * e.b * a.markup, 0));
}

/**
 * The version a backer's page sends with the confirm: the updatedAt it showed, as the server wrote
 * it (ISO-8601 with a zone). Anything else ("1", "2026-10", "October 2026") is no version: the page
 * reloads and shows the terms as they are, instead of the database refusing the date.
 */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
export function seenVersion(x: unknown): string | null {
  return typeof x === 'string' && ISO.test(x) && Number.isFinite(Date.parse(x)) ? x : null;
}

/** New terms (markup, events, currency, or who the backer is) need the backer to confirm again. */
export function termsChanged(prev: Agreement, next: Agreement): boolean {
  return prev.markup !== next.markup || prev.cur !== next.cur || prev.backer !== next.backer || JSON.stringify(prev.events) !== JSON.stringify(next.events);
}
