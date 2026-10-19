// Swaps between players: each gives the other a percentage of their own prizes, for one
// event or a whole series. The server holds the agreed record (sweatbook.poker/swap/<id>);
// the phone keeps a copy plus its side's token. Pure, so it can be tested.
//
// Same shapes as web/src/lib/swap-terms.ts (the server rebuilds them field by field).

import { assignGroups, groupLedger, groupNet, groupReady, HALF_CENT, minTransfers, onePerCid, type SwapGroup } from './swap-groups';
import { t } from '@/i18n';

import type { Session } from './types';

export type SwapSide = 'a' | 'b';

export interface SwapTerms {
  v: 1;
  scope: 'event' | 'series';
  /** The event, or the series ("WSOP Paradise 2026"). */
  title: string;
  venue: string;
  currency: string;
  /** a: who proposed it. b: who confirmed it. pct: the share of their own prizes they give. */
  a: { name: string; pct: number };
  b: { name: string; pct: number };
  note: string;
  createdAt: number;
}

/** A prize one side won (they owe the other their % of it), or a payment one side made. */
export interface SwapEntry {
  id: string;
  /** This phone's id for it, so a resend after no signal never adds it twice. */
  cid: string;
  side: SwapSide;
  /** received: the other side paid me. Recorded by who got it, so it only ever lowers what they owe. */
  kind: 'result' | 'payment' | 'received';
  event: string;
  /** Results: the whole prize. Payments: what was paid to the other side. */
  amount: number;
  finish: number | null;
  /** Recorded by the server (ms). */
  at: number;
  /** Saved here, not yet on the server (no signal). */
  pending?: boolean;
}

/** As the server returns it. */
export interface RemoteSwap {
  id: string;
  terms: SwapTerms;
  confirmedAt: string | null;
  confirmedName: string | null;
  entries: SwapEntry[];
  code: string | null;
  you: SwapSide | null;
  updatedAt: string;
  /** The side that erased their data: read-only from then on. */
  leftSide?: SwapSide | null;
  /** Only to a player in it: the creator has Pro, so the accounts are open to both. */
  accounts?: boolean;
}

/** The phone's copy. */
export interface Swap {
  /** The server's id: also the link. */
  id: string;
  token: string;
  side: SwapSide;
  terms: SwapTerms;
  confirmedAt?: number;
  confirmedName?: string;
  code?: string;
  entries: SwapEntry[];
  /** The other player deleted it: the copy stays here as the record. */
  gone?: boolean;
  /** Settled and put away. */
  archived?: boolean;
  /** The other player erased their data: kept here read-only, amounts as they were. */
  left?: SwapSide;
  syncedAt?: number;
  /** This phone only: which of my sessions each of my prizes came from (entry cid → session id). */
  links?: Record<string, string>;
  /** This phone only: send my result when a tournament of this swap ends, without asking. */
  autoShare?: boolean;
  /** The creator has Pro (from the server): who owes whom is open to both, Pro or not. */
  accounts?: boolean;
  /** Side a only: the RevenueCat id last sent as the creator's, to send it again when it changes. */
  ownerRc?: string;
  createdAt: number;
  updatedAt: number;
}

/** One event, my result in and theirs not yet: the side the swap waits on (null when nobody). */
export function waitingOn(s: Swap): SwapSide | null {
  if (s.terms.scope !== 'event' || !s.confirmedAt || s.left || s.gone) return null;
  const has = (side: SwapSide) => s.entries.some((e) => e.side === side && e.kind === 'result');
  const them = other(s.side);
  return has(s.side) && !has(them) ? them : null;
}

/** Server ids (short_id(), as web/src/lib/swaps.ts validId) and side tokens (64 hex). Checked
 * before either goes into a URL or a header, e.g. from a restored backup or a link. */
export const validSwapId = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9]{6,16}$/.test(x);
export const validSwapToken = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);

export const other = (s: SwapSide): SwapSide => (s === 'a' ? 'b' : 'a');

/** Names as both players see them: the confirmed name wins over what the proposer typed. */
export function swapNames(s: Pick<Swap, 'terms' | 'confirmedName'>): Record<SwapSide, string> {
  // "-": that player erased their data.
  const n = (x: string) => (x === '-' ? t('o outro jogador') : x);
  return { a: n(s.terms.a.name), b: n(s.confirmedName || s.terms.b.name) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What one prize costs its winner: their % of it, owed to the other side. */
export function owedOn(terms: Pick<SwapTerms, 'a' | 'b'>, e: Pick<SwapEntry, 'side' | 'amount'>): number {
  return r2((terms[e.side].pct / 100) * e.amount);
}

export interface SwapLedger {
  /** What I owe from my prizes, and what they owe from theirs. */
  iOwe: number;
  theyOwe: number;
  iPaid: number;
  theyPaid: number;
  /** Positive: they owe me. Negative: I owe them. */
  balance: number;
  myPrizes: number;
  theirPrizes: number;
  /** What the swap did to my result: my share of their prizes less my share given away. */
  effect: number;
}

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
  const by = new Map<string, { payer: SwapSide; cents: number; p: Paid[]; r: Paid[] }>();
  for (const e of entries) {
    if (e.kind === 'result') continue;
    const payer: SwapSide = e.kind === 'payment' ? e.side : other(e.side);
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
export function seenTag(entries: Pick<SwapEntry, 'side' | 'kind' | 'amount'>[], me: SwapSide, kind: string, amount: number): string {
  if (kind !== 'payment' && kind !== 'received') return '';
  const cents = Math.round(amount * 100);
  const want = kind === 'payment' ? 'received' : 'payment';
  return '~' + entries.filter((e) => e.side !== me && e.kind === want && Math.round(e.amount * 100) === cents).length;
}

/** Where I stand in one swap, from my side. Pending entries count: they are mine and real. */
export function swapLedger(s: Pick<Swap, 'terms' | 'entries' | 'side'>): SwapLedger {
  const me = s.side;
  const entries = onePerCid(s.entries, (e) => e.side);
  let iOwe = 0;
  let theyOwe = 0;
  let myPrizes = 0;
  let theirPrizes = 0;
  for (const e of entries) {
    const mine = e.side === me;
    if (e.kind === 'result') {
      const o = owedOn(s.terms, e);
      if (mine) {
        iOwe += o;
        myPrizes += e.amount;
      } else {
        theyOwe += o;
        theirPrizes += e.amount;
      }
    }
  }
  const paid = paidBySide(entries);
  const iPaid = paid[me];
  const theyPaid = paid[other(me)];
  return {
    iOwe: r2(iOwe),
    theyOwe: r2(theyOwe),
    iPaid: r2(iPaid),
    theyPaid: r2(theyPaid),
    balance: r2(theyOwe - theyPaid - (iOwe - iPaid)),
    myPrizes: r2(myPrizes),
    theirPrizes: r2(theirPrizes),
    effect: r2(theyOwe - iOwe),
  };
}

export const settled = (l: SwapLedger) => Math.abs(l.balance) < HALF_CENT;

export interface SwapsTotal {
  /** Per currency: what others owe me minus what I owe, over every open swap. */
  byCurrency: Map<string, { owedToMe: number; iOwe: number; net: number }>;
  open: number;
  pending: number;
}

/** All swaps at a glance, kept apart by currency (a $ swap and a € swap don't add up). */
/** Header totals across pair swaps and, when given, groups (what the group owes me, or I owe it). */
export function swapsTotal(list: Swap[], groups: SwapGroup[] = []): SwapsTotal {
  const byCurrency = new Map<string, { owedToMe: number; iOwe: number; net: number }>();
  let open = 0;
  let pending = 0;
  for (const s of list) {
    // Archived, or deleted by the other player: out of the header totals.
    if (s.archived || s.gone) continue;
    if (!s.confirmedAt) {
      if (!s.gone) pending++;
      continue;
    }
    open++;
    const l = swapLedger(s);
    const cur = byCurrency.get(s.terms.currency) ?? { owedToMe: 0, iOwe: 0, net: 0 };
    if (l.balance > 0) cur.owedToMe = r2(cur.owedToMe + l.balance);
    else cur.iOwe = r2(cur.iOwe - l.balance);
    cur.net = r2(cur.owedToMe - cur.iOwe);
    byCurrency.set(s.terms.currency, cur);
  }
  for (const g of groups) {
    if (g.archived || g.gone) continue;
    if (!groupReady(g)) {
      pending++;
      continue;
    }
    open++;
    const b = groupLedger(g).balance;
    const cur = byCurrency.get(g.terms.currency) ?? { owedToMe: 0, iOwe: 0, net: 0 };
    if (b > 0) cur.owedToMe = r2(cur.owedToMe + b);
    else cur.iOwe = r2(cur.iOwe - b);
    cur.net = r2(cur.owedToMe - cur.iOwe);
    byCurrency.set(g.terms.currency, cur);
  }
  return { byCurrency, open, pending };
}

/** The phone's copy updated from the server, keeping entries the server hasn't got yet. */
export function mergeRemote(local: Swap, remote: RemoteSwap, now = Date.now()): Swap {
  const onServer = new Set(remote.entries.filter((e) => e.side === local.side).map((e) => e.cid));
  const stillPending = local.entries.filter((e) => e.pending && !onServer.has(e.cid));
  // A player who erased their data has their name scrubbed on the server; the copy on this
  // phone already knew it and keeps it (a restored phone shows "o outro jogador").
  const keep = (x: string, mine: string | undefined) => (x === '-' && mine && mine !== '-' ? mine : x);
  const terms = remote.leftSide
    ? { ...remote.terms, a: { ...remote.terms.a, name: keep(remote.terms.a.name, local.terms.a.name) }, b: { ...remote.terms.b, name: keep(remote.terms.b.name, local.terms.b.name) } }
    : remote.terms;
  const confirmedName = remote.confirmedName ?? undefined;
  return {
    ...local,
    terms,
    confirmedAt: remote.confirmedAt ? Date.parse(remote.confirmedAt) : undefined,
    confirmedName: remote.leftSide && confirmedName ? keep(confirmedName, local.confirmedName) : confirmedName,
    code: remote.code ?? undefined,
    left: remote.leftSide ?? undefined,
    accounts: remote.accounts ?? local.accounts,
    // A copy the server saved twice shows and notifies once (onePerCid).
    entries: [...onePerCid(remote.entries, (e) => e.side).map(({ pending: _, ...e }) => e), ...stillPending],
    gone: false,
    syncedAt: now,
    updatedAt: now,
  };
}

/** A new swap, from the server's reply to the side that holds `token`. */
export function fromRemote(remote: RemoteSwap, token: string, side: SwapSide, now = Date.now()): Swap {
  return mergeRemote({ id: remote.id, token, side, terms: remote.terms, entries: [], createdAt: now, updatedAt: now }, remote, now);
}

/** The server deletes "Delete all my data" queues: every swap this phone can still reach. */
export function swapDeleteJobs(list: Pick<Swap, 'id' | 'token' | 'gone'>[]): { id: string; token: string }[] {
  return list.filter((s) => !s.gone && !!s.token).map((s) => ({ id: s.id, token: s.token }));
}

/** Merges a backup's swaps in: new ones added, the later copy of each wins, pending entries kept. */
export function mergeSwaps(local: Swap[], incoming: Swap[]): { list: Swap[]; added: number } {
  const byId = new Map(local.map((s) => [s.id, s]));
  let added = 0;
  let changed = false;
  for (const x of incoming) {
    const cur = byId.get(x.id);
    if (!cur) {
      byId.set(x.id, x);
      added++;
      changed = true;
    } else if (x.updatedAt > cur.updatedAt) {
      const cids = new Set(x.entries.map((e) => e.side + e.cid));
      byId.set(x.id, { ...x, entries: [...x.entries, ...cur.entries.filter((e) => e.pending && !cids.has(e.side + e.cid))] });
      changed = true;
    }
  }
  return { list: changed ? [...byId.values()] : local, added };
}

const DAY = 86400000;

export interface SwapAssignment {
  /** Per session id: what swaps add (+) or take (−). */
  bySession: Map<string, number>;
  /** Prizes with no session of mine to count them in (shown on the swaps screen). */
  unassigned: { swapId: string; cid: string }[];
}

/**
 * Where each swapped prize lands in my results:
 * - my prize: the session it came from (the link saved when I picked it, else my finished
 *   tournament in that currency with that exact prize, preferring the same name) loses my %;
 * - their prize: my latest finished session in that currency since the swap began, up to
 *   when they recorded it, gains my share (for a single event, my session of that event).
 * Busts (prize 0) change nothing. Unconfirmed swaps count for nothing.
 */
export function assignSwaps(sessions: Session[], swaps: Swap[]): SwapAssignment {
  const bySession = new Map<string, number>();
  const unassigned: SwapAssignment['unassigned'] = [];
  const ended = sessions.filter((s) => s.endedAt).sort((a, b) => b.endedAt! - a.endedAt!);
  const add = (id: string, d: number) => bySession.set(id, (bySession.get(id) ?? 0) + d);
  for (const sw of swaps) {
    if (!sw.confirmedAt) continue;
    const cur = sw.terms.currency;
    const from = sw.terms.createdAt - 2 * DAY;
    const mine = ended.filter((s) => s.currency === cur && s.startedAt >= from);
    for (const e of onePerCid(sw.entries, (x) => x.side)) {
      if (e.kind !== 'result' || !e.amount) continue;
      const owed = owedOn(sw.terms, e);
      let id: string | undefined;
      if (e.side === sw.side) {
        id = sw.links?.[e.cid];
        if (!id || !sessions.some((s) => s.id === id)) {
          const same = mine.filter((s) => s.kind === 'mtt' && s.cashOut === e.amount);
          id = (same.find((s) => s.name === e.event) ?? same[0])?.id;
        }
      } else {
        const upTo = mine.filter((s) => s.startedAt <= e.at + DAY);
        id = (sw.terms.scope === 'event' ? upTo.find((s) => s.name === sw.terms.title) : undefined)?.id ?? upTo[0]?.id;
      }
      if (id) add(id, e.side === sw.side ? -owed : owed);
      else unassigned.push({ swapId: sw.id, cid: e.cid });
    }
  }
  return { bySession, unassigned };
}

/** The sessions with Session.swapNet filled in (read by profit()). Unchanged sessions keep their identity. */
export function withSwaps(sessions: Session[], swaps: Swap[], groups: SwapGroup[] = []): Session[] {
  if (!swaps.length && !groups.length && !sessions.some((s) => s.swapNet)) return sessions;
  const { bySession } = assignSwaps(sessions, swaps);
  for (const [id, v] of assignGroups(sessions, groups).bySession) bySession.set(id, (bySession.get(id) ?? 0) + v);
  return sessions.map((s) => {
    const n = bySession.get(s.id);
    const v = n && Math.abs(n) >= 0.005 ? Math.round(n * 100) / 100 : undefined;
    return (s.swapNet ?? undefined) === v ? s : { ...s, swapNet: v };
  });
}

// A session started from the festival plan is named per flight ("#12 $5k PLO · Flight A"); a swap
// for the event covers every flight.
const eventKey = (x: string) => x.trim().toLowerCase().replace(/\s*·\s*flight\s+\w+$/, '');
const sameName = (a: string, b: string) => !!eventKey(a) && eventKey(a) === eventKey(b);

/**
 * The swaps a tournament I just finished belongs to, still waiting for my result from it:
 * confirmed, same currency, played since the swap began, and for a single-event swap that
 * event (same name, or the swap was agreed while I was playing it).
 */
export function swapsForSession(swaps: Swap[], s: Session): Swap[] {
  if (s.kind !== 'mtt' || !s.endedAt) return [];
  return swaps.filter((sw) => {
    if (!sw.confirmedAt || sw.gone || sw.archived || sw.terms.currency !== s.currency) return false;
    if (s.startedAt < sw.terms.createdAt - 2 * DAY) return false;
    if (sw.terms.scope === 'event' && !sameName(sw.terms.title, s.name) && !(sw.terms.createdAt >= s.startedAt && sw.terms.createdAt <= s.endedAt!)) return false;
    const linked = new Set(Object.entries(sw.links ?? {}).filter(([, id]) => id === s.id).map(([cid]) => cid));
    return !sw.entries.some((e) => e.side === sw.side && e.kind === 'result' && (linked.has(e.cid) || (sameName(e.event, s.name) && e.amount === (s.cashOut || 0))));
  });
}

/** Entries the other player added since `before`: what to tell me about after a sync. */
export function newFromOther(before: Swap | undefined, after: Swap): SwapEntry[] {
  if (!before) return [];
  const seen = new Set(before.entries.map((e) => e.side + e.id));
  return after.entries.filter((e) => e.side !== after.side && !seen.has(e.side + e.id));
}

/** Swaps and groups where money is still owed either way ("Delete all my data" warns about them). */
export function unsettledSwaps(swaps: Swap[], groups: SwapGroup[]): number {
  const pairs = swaps.filter((s) => s.confirmedAt && !s.gone && !s.archived && !s.left && !settled(swapLedger(s))).length;
  const grps = groups.filter((g) => groupReady(g) && !g.gone && !g.archived && Math.abs(groupLedger(g).balance) >= HALF_CENT).length;
  return pairs + grps;
}

/** A one-event swap with every result in and money still owed: "falta acertar". */
export interface ToSettle {
  id: string;
  group: boolean;
  /** The event, or the city when the swap has one ("O swap de Lisboa"). */
  place: string;
  /** Pair: the other player. Group: the swap's title. */
  name: string;
  /** I pay, or I'm paid: the payer lands on "Paguei", the other on the accounts. */
  pay: boolean;
  /** When the last result came in. */
  closedAt: number;
}

/**
 * The swaps where everyone's result is in and I still pay or get paid, newest first. Only one
 * event: a series has no last result. A group counts only the transfers that involve me.
 */
export function swapsToSettle(swaps: Swap[], groups: SwapGroup[]): ToSettle[] {
  const out: ToSettle[] = [];
  const lastResult = (list: { kind: string; at: number }[]) => Math.max(0, ...list.filter((e) => e.kind === 'result').map((e) => e.at));
  for (const s of swaps) {
    if (s.terms.scope !== 'event' || !s.confirmedAt || s.gone || s.archived || s.left) continue;
    if (!(['a', 'b'] as const).every((side) => s.entries.some((e) => e.side === side && e.kind === 'result'))) continue;
    const l = swapLedger(s);
    if (settled(l)) continue;
    const name = swapNames(s)[other(s.side)];
    out.push({ id: s.id, group: false, place: s.terms.venue || s.terms.title, name, pay: l.balance < 0, closedAt: lastResult(s.entries) });
  }
  for (const g of groups) {
    if (g.terms.scope !== 'event' || !groupReady(g) || g.gone || g.archived || g.removed || g.seats.some((x) => x.name === '-')) continue;
    if (!g.seats.every((x) => g.entries.some((e) => e.seat === x.seat && e.kind === 'result'))) continue;
    const mine = minTransfers(groupNet(g)).filter((x) => x.from === g.seat || x.to === g.seat);
    if (!mine.length) continue;
    out.push({ id: g.id, group: true, place: g.terms.venue || g.terms.title, name: g.terms.title, pay: mine.some((x) => x.from === g.seat), closedAt: lastResult(g.entries) });
  }
  return out.sort((a, b) => b.closedAt - a.closedAt);
}

/** One swap's part in settling up with a player: the entry that brings it to 0,00. */
export interface SettleStep {
  id: string;
  kind: 'payment' | 'received';
  amount: number;
}

export interface SettleGroup {
  /** The other player as I see them, and the currency: one settle-up per pair. */
  name: string;
  currency: string;
  swaps: Swap[];
  /** Positive: they pay me. Negative: I pay them. Over every swap in the group. */
  net: number;
}

const nameKey = (n: string) => n.trim().toLocaleLowerCase();

/**
 * Open swaps with the same player in the same currency, where something is still owed: several
 * of them can be settled with one payment. Only groups of two or more (one swap has its own buttons).
 */
export function settleGroups(list: Swap[]): SettleGroup[] {
  const by = new Map<string, SettleGroup>();
  for (const s of list) {
    if (!s.confirmedAt || s.archived || s.gone || s.left) continue;
    const name = swapNames(s)[other(s.side)];
    if (s.terms[other(s.side)].name === '-' || s.entries.some((e) => e.pending)) continue;
    if (settled(swapLedger(s))) continue;
    const k = nameKey(name) + '\u0000' + s.terms.currency;
    const g = by.get(k) ?? { name, currency: s.terms.currency, swaps: [], net: 0 };
    g.swaps.push(s);
    by.set(k, g);
  }
  return [...by.values()]
    .filter((g) => g.swaps.length >= 2)
    .map((g) => ({ ...g, net: settleNet(g.swaps) }));
}

/** What changes hands once the chosen swaps are settled. Positive: they pay me. */
export const settleNet = (list: Swap[]) => r2(list.reduce((n, s) => n + swapLedger(s).balance, 0));

/**
 * The entries that close each swap: where I owe, my payment; where they owe, that I received it.
 * Every swap ends at 0,00 and only the net changes hands. Both kinds are mine to record.
 */
export function settleSteps(list: Swap[]): SettleStep[] {
  const out: SettleStep[] = [];
  for (const s of list) {
    const b = swapLedger(s).balance;
    if (Math.abs(b) < HALF_CENT) continue;
    out.push({ id: s.id, kind: b > 0 ? 'received' : 'payment', amount: r2(Math.abs(b)) });
  }
  return out;
}
