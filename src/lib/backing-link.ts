// A backer's statement as a link: sweatbook.poker/b#<data>. The player sends it
// with "Enviar contas"; the backer opens it in the browser, or saves it in their own
// Sweatbook to follow everyone they back in one place.
//
// The data rides in the URL fragment, which browsers never send to a server, so
// the amounts stay between the two of them. Only this backer's own pieces go out:
// no notes, no hands, no other backers' names or amounts.

import { backerLedger, packageStates, type BackerLedger, type YearStatement } from '@/store/staking';
import type { Backer, BackerPayment, Session, StakePackage } from '@/store/types';
import { BRAND } from '@/theme';

/** Most sessions a statement carries (newest first): keeps the link short enough for any chat app. */
export const MAX_ROWS = 30;
export const MAX_YEAR_ROWS = 24;

export interface StatementRow {
  /** Session start. */
  d: number;
  /** Ended at, or null while it runs. */
  e: number | null;
  /** Session name. */
  n: string;
  k: Session['kind'];
  /** % of the player's action this piece is. */
  sh: number;
  mu: number;
  /** What the backer put in. */
  c: number;
  /** What they get back (0 while it runs). */
  o: number;
  /** Not paid for yet. */
  u?: 1;
  /** Package name, if the piece is in one. */
  p?: string;
  /** Live link id, to follow the session while it runs. */
  l?: string;
  /** The session's currency, when it isn't the statement's: c and o are in it. */
  cu?: string;
}

/** "O ano com {backer}": one row per package (n '' = outside a package), in the statement's currency. */
export interface StatementYear {
  y: number;
  pk: { n: string; s: number; c: number; o: number; mk: number; net: number }[];
}

export interface Statement {
  v: 1;
  /** Stable per player and backer, so a newer statement replaces the older one. */
  id: string;
  /** The player's nickname. */
  pl: string;
  /** The name the player saved the backer under. */
  bk: string;
  cur: string;
  /** When the player sent it. */
  at: number;
  /** Positive: the player owes the backer. */
  bal: number;
  /** Losses still to win back in open makeup packages. */
  mk: number;
  inv: number;
  res: number;
  rows: StatementRow[];
  /** Sent with "Enviar o resumo do ano". */
  yr?: StatementYear;
  /** The next festival event the backer has a piece of: its name and the venue's wall clock, 'YYYY-MM-DDTHH:MM'. */
  nx?: { n: string; s: string };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The statement for one backer, from the player's data. */
export function buildStatement(
  backer: Backer & { shareKey: string },
  player: string,
  currency: string,
  sessions: Session[],
  packages: StakePackage[],
  payments: BackerPayment[],
  now = Date.now(),
  year?: YearStatement,
  /** The ledger the app shows (rates applied, festival pieces not played yet counted): the link must say the same. */
  ledger?: BackerLedger,
): Statement {
  const l = ledger ?? backerLedger(backer.id, sessions, packages, payments, packageStates(sessions, packages));
  const pkgName = new Map(packages.map((p) => [p.id, p.name]));
  const st: Statement = {
    v: 1,
    id: backer.shareKey,
    pl: player.slice(0, 40),
    bk: backer.name.slice(0, 40),
    cur: currency,
    at: now,
    bal: r2(l.balance),
    mk: r2(l.makeup),
    inv: r2(l.invested),
    res: r2(l.result),
    rows: l.rows.slice(0, MAX_ROWS).map((r) => {
      const s = r.session;
      const row: StatementRow = { d: s.startedAt, e: s.endedAt ?? null, n: (s.name || '').slice(0, 60), k: s.kind, sh: r.stake.share, mu: r.stake.markup || 1, c: r2(r.cost), o: r2(r.owed) };
      if (r.stake.unpaid) row.u = 1;
      const p = r.stake.packageId ? pkgName.get(r.stake.packageId) : undefined;
      if (p) row.p = p.slice(0, 40);
      if (s.live?.id && !s.endedAt) row.l = s.live.id;
      if (s.currency && s.currency !== currency) row.cu = s.currency.slice(0, 4);
      return row;
    }),
  };
  if (year)
    st.yr = {
      y: year.year,
      pk: year.rows.slice(0, MAX_YEAR_ROWS).map((p) => ({ n: p.name.slice(0, 40), s: p.sessions, c: r2(p.cost), o: r2(p.prizes), mk: r2(p.makeup), net: r2(p.net) })),
    };
  return st;
}

// ─── Encoding: JSON → UTF-8 → base64url, without relying on btoa or TextEncoder ───

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function fromUtf8(b: number[]): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i++];
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(c);
  }
  return s;
}

export function encodeStatement(st: Statement): string {
  const b = utf8(JSON.stringify(st));
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '') + (i + 2 < b.length ? B64[n & 63] : '');
  }
  return out;
}

const num = (x: unknown, min: number, max: number) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : null);
const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
const MAX = 1e13;

/** The statement in a link or its data, checked field by field; null if it isn't one. */
export function decodeStatement(raw: string): Statement | null {
  try {
    // A whole pasted message works too: take the data after the link's '#'.
    const m = /\/b\/?(?:\?[^#\s]*)?#([A-Za-z0-9_-]+)/.exec(raw);
    const clean = m ? m[1] : raw.trim().replace(/^#/, '');
    if (!/^[A-Za-z0-9_-]+$/.test(clean)) return null;
    if (clean.length > 40000) return null;
    const b: number[] = [];
    for (let i = 0; i < clean.length; i += 4) {
      const v = [0, 1, 2, 3].map((k) => (i + k < clean.length ? B64.indexOf(clean[i + k]) : 0));
      const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
      b.push((n >> 16) & 255);
      if (i + 2 < clean.length) b.push((n >> 8) & 255);
      if (i + 3 < clean.length) b.push(n & 255);
    }
    return checkStatement(JSON.parse(fromUtf8(b)));
  } catch {
    return null;
  }
}

/** A statement rebuilt field by field from untrusted JSON (a link, a backup); null if it isn't one. */
export function checkStatement(json: unknown): Statement | null {
  try {
    if (!json || typeof json !== 'object') return null;
    const o = json as Record<string, unknown>;
    if (o.v !== 1 || typeof o.id !== 'string' || !/^[A-Za-z0-9_-]{6,40}$/.test(o.id) || !Array.isArray(o.rows)) return null;
    const rows: StatementRow[] = [];
    for (const x of o.rows.slice(0, MAX_ROWS) as Record<string, unknown>[]) {
      if (!x || typeof x !== 'object') continue;
      const d = num(x.d, 0, MAX);
      if (d === null) continue;
      const row: StatementRow = {
        d,
        e: num(x.e, 0, MAX),
        n: str(x.n, 60),
        k: x.k === 'cash' ? 'cash' : 'mtt',
        sh: num(x.sh, 0, 100) ?? 0,
        mu: num(x.mu, 0.5, 5) ?? 1,
        c: num(x.c, -MAX, MAX) ?? 0,
        o: num(x.o, -MAX, MAX) ?? 0,
      };
      if (x.u) row.u = 1;
      if (typeof x.p === 'string' && x.p) row.p = str(x.p, 40);
      if (typeof x.l === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(x.l)) row.l = x.l;
      if (typeof x.cu === 'string' && x.cu) row.cu = str(x.cu, 4);
      rows.push(row);
    }
    const st: Statement = {
      v: 1,
      id: o.id,
      pl: str(o.pl, 40),
      bk: str(o.bk, 40),
      cur: str(o.cur, 4) || '€',
      at: num(o.at, 0, MAX) ?? 0,
      bal: num(o.bal, -MAX, MAX) ?? 0,
      mk: num(o.mk, 0, MAX) ?? 0,
      inv: num(o.inv, -MAX, MAX) ?? 0,
      res: num(o.res, -MAX, MAX) ?? 0,
      rows,
    };
    const nx = o.nx as Record<string, unknown> | undefined;
    if (nx && typeof nx === 'object' && typeof nx.s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(nx.s)) st.nx = { n: str(nx.n, 60), s: nx.s };
    const yr = o.yr as Record<string, unknown> | undefined;
    const y = yr && typeof yr === 'object' ? num(yr.y, 2000, 2200) : null;
    if (yr && y !== null && Array.isArray(yr.pk))
      st.yr = {
        y,
        pk: (yr.pk.slice(0, MAX_YEAR_ROWS) as Record<string, unknown>[])
          .filter((x) => x && typeof x === 'object')
          .map((x) => ({ n: str(x.n, 40), s: num(x.s, 0, 1e5) ?? 0, c: num(x.c, -MAX, MAX) ?? 0, o: num(x.o, -MAX, MAX) ?? 0, mk: num(x.mk, 0, MAX) ?? 0, net: num(x.net, -MAX, MAX) ?? 0 })),
      };
    return st;
  } catch {
    return null;
  }
}

export function statementUrl(st: Statement, ref?: string): string {
  return `${BRAND.webUrl}/b${ref ? `?r=${encodeURIComponent(ref)}` : ''}#${encodeStatement(st)}`;
}
