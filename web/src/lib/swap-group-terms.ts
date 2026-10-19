import { isOffensive } from './moderation';
import { onePerCid, parseEntry } from './swap-terms';

/**
 * A group swap: 3 to 8 players, each gives the same percentage of their own prizes to every
 * other player, for one event or a whole series. Seat 0 created it in the app and named the
 * others; each claims their seat through the group link. Sent by the app
 * (src/store/swap-groups.ts) and rebuilt here field by field.
 */
export interface GroupTerms {
  v: 1;
  scope: 'event' | 'series';
  title: string;
  venue: string;
  currency: string;
  pct: number;
  note: string;
  createdAt: number;
}

export interface GroupSeat {
  seat: number;
  /** "-" once that player left: their numbers stay for the others. */
  name: string;
  confirmedAt: string | null;
}

export interface GroupEntry {
  id: string;
  cid: string;
  seat: number;
  kind: 'result' | 'payment';
  event: string;
  amount: number;
  finish: number | null;
  /** Payments: the seat paid. */
  to?: number;
  at: number;
}

export interface GroupRecord {
  id: string;
  terms: GroupTerms;
  seats: GroupSeat[];
  entries: GroupEntry[];
  createdAt: string;
  updatedAt: string;
}

/** What the app and the page receive: with a token, `you` is the caller's seat. */
export interface PublicGroup extends GroupRecord {
  you: number | null;
}

export const GROUP_MIN = 3;
export const GROUP_MAX = 8;

const num = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');

/** Terms plus the names in seat order (creator first). null when invalid, 'offensive' on moderation. */
export function parseGroup(x: unknown, namesIn: unknown): { terms: GroupTerms; names: string[] } | 'offensive' | null {
  if (!x || typeof x !== 'object' || Array.isArray(x) || !Array.isArray(namesIn)) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || (o.scope !== 'event' && o.scope !== 'series')) return null;
  const p = num(o.pct, 0.1, 20);
  const createdAt = num(o.createdAt, 1, 1e13);
  if (p === null || createdAt === null) return null;
  const names = namesIn.map((n) => str(n, 40));
  if (names.length < GROUP_MIN || names.length > GROUP_MAX || names.some((n) => !n || n === '-')) return null;
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return null;
  const terms: GroupTerms = {
    v: 1,
    scope: o.scope,
    title: str(o.title, 80),
    venue: str(o.venue, 80),
    currency: str(o.currency, 4) || '€',
    pct: Math.round(p * 10) / 10,
    note: str(o.note, 280),
    createdAt,
  };
  if (!terms.title) return null;
  if ([terms.title, terms.venue, terms.note, ...names].some(isOffensive)) return 'offensive';
  return { terms, names };
}

/** An entry as a seat sends it: the server adds id, seat and time. */
export function parseGroupEntry(x: unknown): Omit<GroupEntry, 'id' | 'seat' | 'at'> | 'offensive' | null {
  const e = parseEntry(x);
  if (!e || e === 'offensive') return e;
  // Groups settle seat to seat with payments only.
  const kind = e.kind;
  if (kind === 'received') return null;
  if (kind === 'payment') {
    const to = num((x as Record<string, unknown>).to, 0, GROUP_MAX - 1);
    if (to === null || !Number.isInteger(to)) return null;
    return { ...e, kind, to };
  }
  return { ...e, kind };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Per seat: positive, the others owe them; negative, they owe. Payments already count. */
export function groupNet(terms: Pick<GroupTerms, 'pct'>, seats: Pick<GroupSeat, 'seat'>[], entries: (Pick<GroupEntry, 'seat' | 'kind' | 'amount' | 'to'> & { cid?: string })[]): Map<number, number> {
  const net = new Map(seats.map((s) => [s.seat, 0]));
  const add = (seat: number, d: number) => net.set(seat, (net.get(seat) ?? 0) + d);
  for (const e of onePerCid(entries, (x) => x.seat)) {
    if (e.kind === 'result') {
      const k = r2((terms.pct / 100) * e.amount);
      for (const s of seats) if (s.seat !== e.seat) {
        add(s.seat, k);
        add(e.seat, -k);
      }
    } else if (e.to !== undefined && e.to !== e.seat) {
      add(e.seat, e.amount);
      add(e.to, -e.amount);
    }
  }
  for (const [k, v] of net) net.set(k, r2(v));
  return net;
}

export interface Transfer {
  from: number;
  to: number;
  amount: number;
}

/** Money is counted to the cent: under half a cent is 0,00, anything else is still owed. */
export const HALF_CENT = 0.005;

/** The fewest payments that settle everyone: who owes most pays who is owed most, repeated. */
export function minTransfers(net: Map<number, number>): Transfer[] {
  const debt = [...net].filter(([, v]) => v <= -HALF_CENT).map(([seat, v]) => ({ seat, v: -v }));
  const cred = [...net].filter(([, v]) => v >= HALF_CENT).map(([seat, v]) => ({ seat, v }));
  const out: Transfer[] = [];
  while (debt.length && cred.length) {
    debt.sort((a, b) => b.v - a.v || a.seat - b.seat);
    cred.sort((a, b) => b.v - a.v || a.seat - b.seat);
    const d = debt[0];
    const c = cred[0];
    const x = r2(Math.min(d.v, c.v));
    if (x >= HALF_CENT) out.push({ from: d.seat, to: c.seat, amount: x });
    d.v = r2(d.v - x);
    c.v = r2(c.v - x);
    if (d.v < HALF_CENT) debt.shift();
    if (c.v < HALF_CENT) cred.shift();
  }
  return out;
}
