// Swaps between players: each gives the other a percentage of their own prizes, for one
// event or a whole series. The server holds the agreed record (sweatbook.poker/swap/<id>);
// the phone keeps a copy plus its side's token. Pure, so it can be tested.
//
// Same shapes as web/src/lib/swap-terms.ts (the server rebuilds them field by field).

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
  kind: 'result' | 'payment';
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
  syncedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export const other = (s: SwapSide): SwapSide => (s === 'a' ? 'b' : 'a');

/** Names as both players see them: the confirmed name wins over what the proposer typed. */
export function swapNames(s: Pick<Swap, 'terms' | 'confirmedName'>): Record<SwapSide, string> {
  return { a: s.terms.a.name, b: s.confirmedName || s.terms.b.name };
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

/** Where I stand in one swap, from my side. Pending entries count: they are mine and real. */
export function swapLedger(s: Pick<Swap, 'terms' | 'entries' | 'side'>): SwapLedger {
  const me = s.side;
  let iOwe = 0;
  let theyOwe = 0;
  let iPaid = 0;
  let theyPaid = 0;
  let myPrizes = 0;
  let theirPrizes = 0;
  for (const e of s.entries) {
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
    } else if (mine) iPaid += e.amount;
    else theyPaid += e.amount;
  }
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

export const settled = (l: SwapLedger) => Math.abs(l.balance) < 0.5;

export interface SwapsTotal {
  /** Per currency: what others owe me minus what I owe, over every open swap. */
  byCurrency: Map<string, { owedToMe: number; iOwe: number; net: number }>;
  open: number;
  pending: number;
}

/** All swaps at a glance, kept apart by currency (a $ swap and a € swap don't add up). */
export function swapsTotal(list: Swap[]): SwapsTotal {
  const byCurrency = new Map<string, { owedToMe: number; iOwe: number; net: number }>();
  let open = 0;
  let pending = 0;
  for (const s of list) {
    if (s.archived) continue;
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
  return { byCurrency, open, pending };
}

/** The phone's copy updated from the server, keeping entries the server hasn't got yet. */
export function mergeRemote(local: Swap, remote: RemoteSwap, now = Date.now()): Swap {
  const onServer = new Set(remote.entries.filter((e) => e.side === local.side).map((e) => e.cid));
  const stillPending = local.entries.filter((e) => e.pending && !onServer.has(e.cid));
  return {
    ...local,
    terms: remote.terms,
    confirmedAt: remote.confirmedAt ? Date.parse(remote.confirmedAt) : undefined,
    confirmedName: remote.confirmedName ?? undefined,
    code: remote.code ?? undefined,
    entries: [...remote.entries.map(({ pending: _, ...e }) => e), ...stillPending],
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
