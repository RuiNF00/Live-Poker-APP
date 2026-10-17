// Group swaps: 3 to 8 players, each gives x% of their own prizes to every other player in the
// group, for one event or a whole series. The server keeps the agreed record
// (sweatbook.poker/swap/g/<id>); the phone keeps a copy plus its seat's token. Pure, so it can
// be tested. Same shapes as web/src/lib/swap-group-terms.ts.

import type { Session } from './types';

export interface GroupTerms {
  v: 1;
  scope: 'event' | 'series';
  title: string;
  venue: string;
  currency: string;
  /** What each player gives every other player, of their own prizes. */
  pct: number;
  note: string;
  createdAt: number;
}

export interface GroupSeat {
  seat: number;
  /** "-" once that player left (deleted their data): their numbers stay for the others. */
  name: string;
  confirmedAt?: number;
}

export interface GroupEntry {
  id: string;
  cid: string;
  seat: number;
  kind: 'result' | 'payment';
  event: string;
  /** Results: the whole prize. Payments: what `seat` paid to `to`. */
  amount: number;
  finish: number | null;
  to?: number;
  at: number;
  pending?: boolean;
}

/** As the server returns it. */
export interface RemoteGroup {
  id: string;
  terms: GroupTerms;
  seats: { seat: number; name: string; confirmedAt: string | null }[];
  entries: GroupEntry[];
  you: number | null;
  updatedAt: string;
  /** Only to a player in it: the creator has Pro, so the accounts are open to everyone. */
  accounts?: boolean;
}

/** The phone's copy. */
export interface SwapGroup {
  id: string;
  token: string;
  seat: number;
  /** Only the creator keeps it, to send the group link again. */
  invite?: string;
  terms: GroupTerms;
  seats: GroupSeat[];
  entries: GroupEntry[];
  gone?: boolean;
  archived?: boolean;
  syncedAt?: number;
  /** This phone only: which of my sessions each of my prizes came from (entry cid → session id). */
  links?: Record<string, string>;
  /** This phone only: send my result when a tournament of this group ends, without asking. */
  autoShare?: boolean;
  /** The creator has Pro (from the server): who pays whom is open to everyone, Pro or not. */
  accounts?: boolean;
  /** Seat 0 only: the RevenueCat id last sent as the creator's, to send it again when it changes. */
  ownerRc?: string;
  createdAt: number;
  updatedAt: number;
}

export const GROUP_MIN = 3;
export const GROUP_MAX = 8;

const r2 = (n: number) => Math.round(n * 100) / 100;

export const groupReady = (g: Pick<SwapGroup, 'seats'>) => g.seats.length >= GROUP_MIN && g.seats.every((s) => !!s.confirmedAt);
export const seatName = (g: Pick<SwapGroup, 'seats'>, seat: number) => g.seats.find((s) => s.seat === seat)?.name || '?';

/** What one prize costs its winner in total: x% to each of the others. */
export const groupOwedOn = (g: Pick<SwapGroup, 'terms' | 'seats'>, amount: number) => r2((g.terms.pct / 100) * amount * (g.seats.length - 1));
/** What each other player gets from one prize. */
export const groupShareOf = (g: Pick<SwapGroup, 'terms'>, amount: number) => r2((g.terms.pct / 100) * amount);

/** Per seat: positive, the others owe them; negative, they owe. Payments already count. */
export function groupNet(g: Pick<SwapGroup, 'terms' | 'seats' | 'entries'>): Map<number, number> {
  const net = new Map(g.seats.map((s) => [s.seat, 0]));
  const add = (seat: number, d: number) => net.set(seat, (net.get(seat) ?? 0) + d);
  for (const e of g.entries) {
    if (e.kind === 'result') {
      const k = groupShareOf(g, e.amount);
      for (const s of g.seats) if (s.seat !== e.seat) {
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

/**
 * The fewest payments that settle everyone (Splitwise-style): the one who owes most pays the
 * one owed most, until nothing is left. At most one fewer than the number of players.
 */
export function minTransfers(net: Map<number, number>): Transfer[] {
  const debt = [...net].filter(([, v]) => v <= -0.5).map(([seat, v]) => ({ seat, v: -v }));
  const cred = [...net].filter(([, v]) => v >= 0.5).map(([seat, v]) => ({ seat, v }));
  const out: Transfer[] = [];
  while (debt.length && cred.length) {
    debt.sort((a, b) => b.v - a.v || a.seat - b.seat);
    cred.sort((a, b) => b.v - a.v || a.seat - b.seat);
    const d = debt[0];
    const c = cred[0];
    const x = r2(Math.min(d.v, c.v));
    if (x >= 0.5) out.push({ from: d.seat, to: c.seat, amount: x });
    d.v = r2(d.v - x);
    c.v = r2(c.v - x);
    if (d.v < 0.5) debt.shift();
    if (c.v < 0.5) cred.shift();
  }
  return out;
}

export interface GroupLedger {
  /** Positive: the group owes me. Negative: I owe. */
  balance: number;
  /** What the swap did to my result: my share of their prizes less what I gave from mine. */
  effect: number;
  myPrizes: number;
  othersPrizes: number;
}

export function groupLedger(g: Pick<SwapGroup, 'terms' | 'seats' | 'entries' | 'seat'>): GroupLedger {
  let effect = 0;
  let myPrizes = 0;
  let othersPrizes = 0;
  for (const e of g.entries) {
    if (e.kind !== 'result') continue;
    if (e.seat === g.seat) {
      effect -= groupOwedOn(g, e.amount);
      myPrizes += e.amount;
    } else {
      effect += groupShareOf(g, e.amount);
      othersPrizes += e.amount;
    }
  }
  return { balance: groupNet(g).get(g.seat) ?? 0, effect: r2(effect), myPrizes: r2(myPrizes), othersPrizes: r2(othersPrizes) };
}

export function mergeRemoteGroup(local: SwapGroup, remote: RemoteGroup, now = Date.now()): SwapGroup {
  const onServer = new Set(remote.entries.filter((e) => e.seat === local.seat).map((e) => e.cid));
  const stillPending = local.entries.filter((e) => e.pending && !onServer.has(e.cid));
  return {
    ...local,
    terms: remote.terms,
    seats: remote.seats.map((s) => ({ seat: s.seat, name: s.name, confirmedAt: s.confirmedAt ? Date.parse(s.confirmedAt) : undefined })),
    entries: [...remote.entries.map(({ pending: _, ...e }) => e), ...stillPending],
    accounts: remote.accounts ?? local.accounts,
    gone: false,
    syncedAt: now,
    updatedAt: now,
  };
}

export function groupFromRemote(remote: RemoteGroup, token: string, seat: number, invite?: string, now = Date.now()): SwapGroup {
  return mergeRemoteGroup({ id: remote.id, token, seat, invite, terms: remote.terms, seats: [], entries: [], createdAt: now, updatedAt: now }, remote, now);
}

/** Entries other players added since `before`: what to tell me about after a sync. */
export function newFromOthers(before: SwapGroup | undefined, after: SwapGroup): GroupEntry[] {
  if (!before) return [];
  const seen = new Set(before.entries.map((e) => e.seat + ':' + e.id));
  return after.entries.filter((e) => e.seat !== after.seat && !seen.has(e.seat + ':' + e.id));
}

/** A backup's groups merged in: new ones added, the later copy of each wins, pending entries kept. */
export function mergeGroups(local: SwapGroup[], incoming: SwapGroup[]): { list: SwapGroup[]; added: number } {
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
      const cids = new Set(x.entries.map((e) => e.seat + ':' + e.cid));
      byId.set(x.id, { ...x, entries: [...x.entries, ...cur.entries.filter((e) => e.pending && !cids.has(e.seat + ':' + e.cid))] });
      changed = true;
    }
  }
  return { list: changed ? [...byId.values()] : local, added };
}

/** "Delete all my data": leave every group this phone still holds a seat in. */
export function groupLeaveJobs(list: Pick<SwapGroup, 'id' | 'token' | 'gone'>[]): { id: string; token: string }[] {
  return list.filter((g) => !g.gone && !!g.token).map((g) => ({ id: g.id, token: g.token }));
}

const DAY = 86400000;
const sameName = (a: string, b: string) => !!a.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Per session id, what group swaps add (+) or take (−), with the same rules as pair swaps:
 * my prize loses what I give everyone on the session it came from; each of theirs adds my
 * share to my latest finished session in that currency since the group began.
 */
export function assignGroups(sessions: Session[], groups: SwapGroup[]): { bySession: Map<string, number>; unassigned: { groupId: string; cid: string }[] } {
  const bySession = new Map<string, number>();
  const unassigned: { groupId: string; cid: string }[] = [];
  const ended = sessions.filter((s) => s.endedAt).sort((a, b) => b.endedAt! - a.endedAt!);
  const add = (id: string, d: number) => bySession.set(id, (bySession.get(id) ?? 0) + d);
  for (const g of groups) {
    if (!groupReady(g)) continue;
    const from = g.terms.createdAt - 2 * DAY;
    const mine = ended.filter((s) => s.currency === g.terms.currency && s.startedAt >= from);
    for (const e of g.entries) {
      if (e.kind !== 'result' || !e.amount) continue;
      let id: string | undefined;
      if (e.seat === g.seat) {
        id = g.links?.[e.cid];
        if (!id || !sessions.some((s) => s.id === id)) {
          const same = mine.filter((s) => s.kind === 'mtt' && s.cashOut === e.amount);
          id = (same.find((s) => s.name === e.event) ?? same[0])?.id;
        }
      } else {
        const upTo = mine.filter((s) => s.startedAt <= e.at + DAY);
        id = (g.terms.scope === 'event' ? upTo.find((s) => sameName(s.name, g.terms.title)) : undefined)?.id ?? upTo[0]?.id;
      }
      if (id) add(id, e.seat === g.seat ? -groupOwedOn(g, e.amount) : groupShareOf(g, e.amount));
      else unassigned.push({ groupId: g.id, cid: e.cid });
    }
  }
  return { bySession, unassigned };
}

/** The groups a tournament I just finished belongs to, still waiting for my result from it. */
export function groupsForSession(groups: SwapGroup[], s: Session): SwapGroup[] {
  if (s.kind !== 'mtt' || !s.endedAt) return [];
  return groups.filter((g) => {
    if (!groupReady(g) || g.gone || g.archived || g.terms.currency !== s.currency) return false;
    if (s.startedAt < g.terms.createdAt - 2 * DAY) return false;
    if (g.terms.scope === 'event' && !sameName(g.terms.title, s.name) && !(g.terms.createdAt >= s.startedAt && g.terms.createdAt <= s.endedAt!)) return false;
    const linked = new Set(Object.entries(g.links ?? {}).filter(([, id]) => id === s.id).map(([cid]) => cid));
    return !g.entries.some((e) => e.seat === g.seat && e.kind === 'result' && (linked.has(e.cid) || (sameName(e.event, s.name) && e.amount === (s.cashOut || 0))));
  });
}

/** One event, my result in: the seats still to record theirs (empty when nobody, or before mine). */
export function groupWaitingOn(g: SwapGroup): number[] {
  if (g.terms.scope !== 'event' || !groupReady(g) || g.gone || g.seats.some((s) => s.name === '-')) return [];
  const has = (seat: number) => g.entries.some((e) => e.seat === seat && e.kind === 'result');
  if (!has(g.seat)) return [];
  return g.seats.map((s) => s.seat).filter((seat) => !has(seat));
}
