import { isOffensive } from './moderation';

/**
 * A swap between two players: each gives the other a percentage of their own prizes, for one
 * event or a whole series. Side 'a' proposed it in the app; side 'b' confirmed through the link.
 * Sent by the app (src/store/swaps.ts in the app) and rebuilt here field by field, like the
 * live snapshot: anything else in the request is dropped.
 */
export type Side = 'a' | 'b';

export interface SwapTerms {
  v: 1;
  scope: 'event' | 'series';
  /** The event, or the series ("WSOP Paradise 2026"). */
  title: string;
  venue: string;
  currency: string;
  a: { name: string; pct: number };
  b: { name: string; pct: number };
  /** Optional free text both see ("only events up to $25k", "settle by bank transfer"). */
  note: string;
  createdAt: number;
}

/** A prize one side won (they owe the other their percentage of it), or a payment one side made. */
export interface SwapEntry {
  id: string;
  /** Client id, so a retry from a phone with bad signal never adds it twice. */
  cid: string;
  side: Side;
  /** received: the other side paid me (recorded by who got it, so it only ever lowers what I'm owed). */
  kind: 'result' | 'payment' | 'received';
  /** Results: which event of the series. */
  event: string;
  /** Results: the whole prize. Payments: the amount paid to the other side. */
  amount: number;
  /** Results: finishing place, when given. */
  finish: number | null;
  /** Set by the server when it was recorded. */
  at: number;
}

export interface SwapRecord {
  id: string;
  terms: SwapTerms;
  confirmedAt: string | null;
  confirmedName: string | null;
  /** The side that erased their data: the record stays read-only for the other. */
  leftSide?: Side | null;
  entries: SwapEntry[];
  createdAt: string;
  updatedAt: string;
}

/** What the app and the page receive: the record, its agreement code and, with a token, whose side. */
export interface PublicSwap extends SwapRecord {
  code: string | null;
  you: Side | null;
}

const MAX_MONEY = 1e10;
const num = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');
const pct = (v: unknown) => {
  const n = num(v, 0.1, 50);
  return n === null ? null : Math.round(n * 10) / 10;
};

/** null when it isn't valid terms; 'offensive' when a visible name fails moderation. */
export function parseTerms(x: unknown): SwapTerms | 'offensive' | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || (o.scope !== 'event' && o.scope !== 'series')) return null;
  const a = o.a as Record<string, unknown> | undefined;
  const b = o.b as Record<string, unknown> | undefined;
  const pa = pct(a?.pct);
  const pb = pct(b?.pct);
  const createdAt = num(o.createdAt, 1, 1e13);
  if (pa === null || pb === null || createdAt === null) return null;
  const terms: SwapTerms = {
    v: 1,
    scope: o.scope,
    title: str(o.title, 80),
    venue: str(o.venue, 80),
    currency: str(o.currency, 4) || '€',
    a: { name: str(a?.name, 40), pct: pa },
    b: { name: str(b?.name, 40), pct: pb },
    note: str(o.note, 280),
    createdAt,
  };
  if (!terms.title || !terms.a.name || !terms.b.name) return null;
  if ([terms.title, terms.venue, terms.a.name, terms.b.name, terms.note].some(isOffensive)) return 'offensive';
  return terms;
}

/** An entry as a side sends it: the server adds id, side and time. */
export function parseEntry(x: unknown): Omit<SwapEntry, 'id' | 'side' | 'at'> | 'offensive' | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.kind !== 'result' && o.kind !== 'payment' && o.kind !== 'received') return null;
  const cid = str(o.cid, 40);
  // A prize of 0 is a bust worth recording; a payment of 0 is nothing.
  const amount = num(o.amount, o.kind === 'result' ? 0 : 0.01, MAX_MONEY);
  if (!cid || amount === null) return null;
  const event = o.kind === 'result' ? str(o.event, 80) : '';
  if (event && isOffensive(event)) return 'offensive';
  const finish = o.kind === 'result' ? num(o.finish, 1, 100000) : null;
  return { cid, kind: o.kind, event, amount: Math.round(amount * 100) / 100, finish: finish === null ? null : Math.round(finish) };
}

/** A name typed on the confirmation page. */
export function parseName(x: unknown): string | 'offensive' | null {
  const n = str(x, 40);
  if (!n) return null;
  return isOffensive(n) ? 'offensive' : n;
}

export interface SwapBalance {
  /** What side a owes side b from a's prizes, and the reverse. */
  aOwes: number;
  bOwes: number;
  aPaid: number;
  bPaid: number;
  /** Positive: b owes a. Negative: a owes b. */
  net: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What each side has paid the other. The payer's «Paguei» and the receiver's «Recebi» for the
 * same money are one payment, often both tapped at the table before either phone syncs. Each
 * one's cid ends in «~k»: how many entries of the other kind, for the same payer and amount, its
 * phone had already seen. Two entries only merge when neither had seen the other, so two real
 * payments of the same amount, one recorded by each side, both count. Entries from before the
 * tag (no «~k») count as having seen none. The same on every phone and the web, whatever order
 * the entries arrive in.
 */
export function paidBySide(entries: Paid[]): { a: number; b: number } {
  const by = new Map<string, { payer: Side; cents: number; p: Paid[]; r: Paid[] }>();
  for (const e of entries) {
    if (e.kind === 'result') continue;
    const payer: Side = e.kind === 'payment' ? e.side : (e.side === 'a' ? 'b' : 'a');
    const cents = Math.round(e.amount * 100);
    const x = by.get(payer + cents) ?? { payer, cents, p: [], r: [] };
    (e.kind === 'payment' ? x.p : x.r).push(e);
    by.set(payer + cents, x);
  }
  const out = { a: 0, b: 0 };
  for (const x of by.values()) {
    const p = x.p.sort(byAt);
    const r = x.r.sort(byAt);
    const used = new Set<number>();
    let matches = 0;
    r.forEach((re, j) => {
      const i = p.findIndex((pe, i) => !used.has(i) && i >= seenOf(re.cid) && j >= seenOf(pe.cid));
      if (i >= 0) {
        used.add(i);
        matches++;
      }
    });
    out[x.payer] += x.cents * (p.length + r.length - matches);
  }
  return { a: out.a / 100, b: out.b / 100 };
}

type Paid = Pick<SwapEntry, 'side' | 'kind' | 'amount'> & Partial<Pick<SwapEntry, 'cid' | 'at'>>;
const byAt = (u: Paid, v: Paid) => (u.at ?? 0) - (v.at ?? 0) || ((u.cid ?? '') < (v.cid ?? '') ? -1 : (u.cid ?? '') > (v.cid ?? '') ? 1 : 0);
const seenOf = (cid = '') => {
  const m = /~(\d+)$/.exec(cid);
  return m ? Number(m[1]) : 0;
};

/**
 * The «~k» for a new «Paguei» or «Recebi» by `me`: how many entries of the other kind, for the
 * same payer and amount, this phone already has from the other side (see paidBySide).
 */
export function seenTag(entries: Pick<SwapEntry, 'side' | 'kind' | 'amount'>[], me: Side, kind: string, amount: number): string {
  if (kind !== 'payment' && kind !== 'received') return '';
  const cents = Math.round(amount * 100);
  const want = kind === 'payment' ? 'received' : 'payment';
  return '~' + entries.filter((e) => e.side !== me && e.kind === want && Math.round(e.amount * 100) === cents).length;
}

/** Who owes whom: each side's percentage of the other's prizes, less what each already paid. */
export function swapBalance(terms: Pick<SwapTerms, 'a' | 'b'>, entries: Paid[]): SwapBalance {
  let aOwes = 0;
  let bOwes = 0;
  for (const e of entries) {
    if (e.kind === 'result') {
      // Each prize's share to the cent, as the app does: the two never differ by a cent.
      if (e.side === 'a') aOwes += r2((terms.a.pct / 100) * e.amount);
      else bOwes += r2((terms.b.pct / 100) * e.amount);
    }
  }
  const { a: aPaid, b: bPaid } = paidBySide(entries);
  return { aOwes: r2(aOwes), bOwes: r2(bOwes), aPaid: r2(aPaid), bPaid: r2(bPaid), net: r2(bOwes - bPaid - (aOwes - aPaid)) };
}

/**
 * The browser's own token for a confirm or a seat claim (64 hex, one per page): a retry after
 * a lost answer sends the same one and gets in, instead of "already confirmed".
 */
export const newSwapKey = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * A payment ("payment" by the payer, or "received" by whoever got it) larger than what the payer
 * still owes is the same money recorded twice: both players marked one transfer. Returns what was
 * still owed when the entry is more than that (with a cent of slack for rounding), else null.
 */
export function overpaid(terms: Pick<SwapTerms, 'a' | 'b'>, entries: Pick<SwapEntry, 'side' | 'kind' | 'amount'>[], e: Pick<SwapEntry, 'side' | 'kind' | 'amount'>): number | null {
  if (e.kind === 'result') return null;
  const net = swapBalance(terms, entries).net;
  const payer: Side = e.kind === 'payment' ? e.side : e.side === 'a' ? 'b' : 'a';
  const room = Math.max(0, r2(payer === 'b' ? net : -net));
  return e.amount > room + 0.015 ? room : null;
}
