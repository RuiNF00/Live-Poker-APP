// Staking ledger: what each backer put in, what they are owed, their makeup and
// the balance between you. Pure, so it can be tested; screens call these with
// the store's lists.

import { rate, type ManualRates, type RateTable } from './fx-math';
import { cost, pieceOf, stakesOf, type Cuts } from './session-math';
import type { BackerPayment, Session, Stake, StakePackage } from './types';

const byEnd = (a: Session, b: Session) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt);

/** The backer's money in one piece: action at markup, or their share of the buy-ins in a makeup deal. */
export function stakeCost(s: Session, x: Stake): number {
  return pieceOf(s, x) * cost(s) * (x.markup || 1);
}

/** The backer's share of the prize, before any makeup cut. */
export function stakePrize(s: Session, x: Stake): number {
  return pieceOf(s, x) * (s.cashOut || 0);
}

export interface PackageState {
  pkg: StakePackage;
  sessions: number;
  /** Sessions still running in this package. */
  live: number;
  /** The backer's money in, over the package. */
  invested: number;
  /** The backer's prize share minus their buy-ins, before your cut. */
  net: number;
  /** Losses still to win back before you earn a cut (makeup deals). */
  makeup: number;
  /** What you have earned from this package so far (makeup deals). */
  cut: number;
}

/**
 * Makeup deals: your cut is earned only on the package's profit above its lowest point
 * zero, so it is spread over the sessions as the running total crosses into profit.
 * Session i gets cut% × (max(0, total after i) − max(0, total before i)). The cuts sum to
 * cut% × max(0, final total): makeup is paid back first, a later loss takes back cut
 * already credited.
 */
export interface PackageResult {
  states: Map<string, PackageState>;
  /** Your cut per session, all packages together (see withCuts). */
  cuts: Cuts;
  /** Your cut per package and session, keyed `${packageId}:${sessionId}`. */
  byPackage: Map<string, number>;
}

export function packageStates(sessions: Session[], packages: StakePackage[]): PackageResult {
  const states = new Map<string, PackageState>();
  const cuts: Cuts = new Map();
  const byPackage = new Map<string, number>();
  const byPkg = new Map<string, { s: Session; x: Stake }[]>();
  for (const s of sessions)
    for (const x of stakesOf(s)) {
      if (!x.packageId) continue;
      const list = byPkg.get(x.packageId) ?? [];
      list.push({ s, x });
      byPkg.set(x.packageId, list);
    }
  for (const pkg of packages) {
    // A session with two pieces in the same package counts as one combined piece.
    const rows = merge(byPkg.get(pkg.id) ?? []).sort((a, b) => byEnd(a.s, b.s));
    const st: PackageState = { pkg, sessions: rows.length, live: 0, invested: 0, net: 0, makeup: 0, cut: 0 };
    // Makeup carried over from the previous package is won back first, like this package's own losses.
    const carried = pkg.kind === 'makeup' ? Math.max(0, pkg.makeupIn ?? 0) : 0;
    let cum = -carried;
    for (const { s, x } of rows) {
      st.invested += stakeCost(s, x);
      if (!s.endedAt) {
        st.live++;
        continue;
      }
      const net = stakePrize(s, x) - stakeCost(s, x);
      if (pkg.kind === 'makeup') {
        const c = (pkg.playerCut / 100) * (Math.max(0, cum + net) - Math.max(0, cum));
        cuts.set(s.id, (cuts.get(s.id) ?? 0) + c);
        byPackage.set(`${pkg.id}:${s.id}`, c);
        st.cut += c;
      }
      cum += net;
    }
    st.net = cum + carried;
    st.makeup = pkg.kind === 'makeup' ? Math.max(0, -cum) : 0;
    states.set(pkg.id, st);
  }
  return { states, cuts, byPackage };
}

function merge(rows: { s: Session; x: Stake }[]): { s: Session; x: Stake }[] {
  const out = new Map<string, { s: Session; x: Stake }>();
  for (const r of rows) {
    const cur = out.get(r.s.id);
    out.set(r.s.id, cur ? { s: r.s, x: { ...cur.x, share: cur.x.share + r.x.share } } : r);
  }
  return [...out.values()];
}

/**
 * Closing a makeup package that still has makeup: the player and backer either
 * forgive it (it ends with the package) or carry it to a new package on the same
 * terms, where it is won back first. Returns the closed package and the new one.
 */
export function closePackage(p: StakePackage, makeup: number, carry: boolean, newId: string, now = Date.now()): { closed: StakePackage; next: StakePackage | null } {
  const closed = { ...p, closedAt: now };
  if (!carry || p.kind !== 'makeup' || makeup < 0.5) return { closed, next: null };
  const next: StakePackage = {
    id: newId,
    backerId: p.backerId,
    name: p.name,
    kind: 'makeup',
    share: p.share,
    markup: 1,
    playerCut: p.playerCut,
    makeupIn: Math.round(makeup * 100) / 100,
    createdAt: now,
  };
  return { closed, next };
}

export interface BackerLedgerRow {
  session: Session;
  stake: Stake;
  /** Their money in. */
  cost: number;
  /** Their share of the prize, before your cut. 0 while it runs. */
  prize: number;
  /** Your makeup cut out of that share. */
  cut: number;
  /** What they get back from this session (prize share, less your makeup cut). 0 while it runs. */
  owed: number;
}

export interface BackerLedger {
  rows: BackerLedgerRow[];
  /**
   * The currency the deal is kept in: the one most of their money went in at.
   * Rows keep their session's currency; every total below is in this one.
   */
  currency: string;
  /** Session currencies with no rate to convert them: counted as if they were `currency`. */
  missing: string[];
  /** Their money in, over every session. */
  invested: number;
  /** Their result: owed minus invested, ended sessions only. */
  result: number;
  /** Their prize shares, before your cut (ended sessions). */
  prizes: number;
  /** Your makeup cuts out of those prizes. */
  cut: number;
  /** What they get back: prizes minus cut. */
  owed: number;
  /** Pieces they haven't paid for yet. */
  unpaid: number;
  /** Net of payments (positive: you paid them). */
  paid: number;
  /** What you owe them now. Negative: they owe you. */
  balance: number;
  /** Makeup across their open packages. */
  makeup: number;
  live: number;
}

/** Everything between you and one backer, newest session first. */
export function backerLedger(
  backerId: string,
  sessions: Session[],
  packages: StakePackage[],
  payments: BackerPayment[],
  pk = packageStates(sessions, packages),
  fx: { table: RateTable; fallback: string; manual?: ManualRates } = { table: {}, fallback: '' },
): BackerLedger {
  const pkgOf = new Map(packages.map((p) => [p.id, p]));
  const rows: BackerLedgerRow[] = [];
  for (const s of sessions)
    for (const x of stakesOf(s)) {
      if (x.backerId !== backerId) continue;
      const pkg = x.packageId ? pkgOf.get(x.packageId) : undefined;
      const prize = s.endedAt ? stakePrize(s, x) : 0;
      // In a makeup deal your cut comes out of what they get back.
      const cut = s.endedAt && pkg?.kind === 'makeup' ? (pk.byPackage.get(`${pkg.id}:${s.id}`) ?? 0) * (pieceOf(s, x) / packagePiece(s, pkg.id)) : 0;
      rows.push({ session: s, stake: x, cost: stakeCost(s, x), prize, cut, owed: prize - cut });
    }
  rows.sort((a, b) => byEnd(b.session, a.session));
  const currency = dealCurrency(rows) ?? fx.fallback;
  // Each session's money in the deal's currency, at that day's rate.
  const missing = new Set<string>();
  const k = (r: BackerLedgerRow) => {
    const c = r.session.currency;
    if (!c || c === currency) return 1;
    const x = rate(fx.table, c, currency, r.session.startedAt, fx.manual);
    if (x === null) missing.add(c);
    return x ?? 1;
  };
  const done = rows.filter((r) => r.session.endedAt);
  const invested = rows.reduce((a, r) => a + r.cost * k(r), 0);
  const prizes = done.reduce((a, r) => a + r.prize * k(r), 0);
  const cut = done.reduce((a, r) => a + r.cut * k(r), 0);
  const owed = prizes - cut;
  const unpaid = rows.filter((r) => r.stake.unpaid).reduce((a, r) => a + r.cost * k(r), 0);
  const paid = payments.filter((p) => p.backerId === backerId).reduce((a, p) => a + p.amount, 0);
  const makeup = packages.filter((p) => p.backerId === backerId && !p.closedAt).reduce((a, p) => a + (pk.states.get(p.id)?.makeup ?? 0), 0);
  return {
    rows,
    currency,
    missing: [...missing],
    invested,
    result: owed - done.reduce((a, r) => a + r.cost * k(r), 0),
    prizes,
    cut,
    owed,
    unpaid,
    paid,
    balance: owed - unpaid - paid,
    makeup,
    live: rows.length - done.length,
  };
}

/** The currency most of the backer's money went in at (ties: the newest session's). Undefined with no sessions. */
function dealCurrency(rows: BackerLedgerRow[]): string | undefined {
  const by = new Map<string, number>();
  for (const r of rows) if (r.session.currency) by.set(r.session.currency, (by.get(r.session.currency) ?? 0) + r.cost);
  let best: string | undefined;
  for (const r of rows) {
    const c = r.session.currency;
    if (c && (best === undefined || (by.get(c) ?? 0) > (by.get(best) ?? 0))) best = c;
  }
  return best;
}

/**
 * Where you stand with every backer, for the headline. Each balance stays in its
 * deal's currency; with more than one currency, the totals are also given in
 * `home` at today's rate (`approx`), or per currency when a rate is missing.
 */
export function stakingTotals(ledgers: BackerLedger[], home: string, table: RateTable, manual: ManualRates = {}, now = Date.now()) {
  const per = new Map<string, { owe: number; owed: number }>();
  let oweTo = 0;
  let owedBy = 0;
  for (const l of ledgers) {
    const c = l.currency || home;
    const acc = per.get(c) ?? { owe: 0, owed: 0 };
    acc.owe += Math.max(0, l.balance);
    acc.owed += Math.max(0, -l.balance);
    per.set(c, acc);
    if (l.balance >= 0.5) oweTo++;
    if (l.balance <= -0.5) owedBy++;
  }
  const byCurrency = [...per.entries()].map(([currency, acc]) => ({ currency, ...acc })).filter((x) => x.owe >= 0.5 || x.owed >= 0.5);
  const cur = byCurrency.length === 1 ? byCurrency[0].currency : home;
  let owe = 0;
  let owed = 0;
  let convertible = true;
  for (const x of byCurrency) {
    const r = rate(table, x.currency, cur, now, manual);
    if (r === null) convertible = false;
    owe += x.owe * (r ?? 1);
    owed += x.owed * (r ?? 1);
  }
  return {
    currency: cur,
    owe,
    owed,
    oweTo,
    owedBy,
    /** Totals converted from other currencies at today's rate. */
    approx: convertible && byCurrency.some((x) => x.currency !== cur),
    /** Set when the currencies can't be added up: show these instead of one number. */
    split: convertible ? null : byCurrency,
  };
}

export type StakingTotals = ReturnType<typeof stakingTotals>;

/** A session's pieces in one package (normally one): the cut is split between them. */
function packagePiece(s: Session, pkgId: string): number {
  const total = stakesOf(s).filter((x) => x.packageId === pkgId).reduce((a, x) => a + pieceOf(s, x), 0);
  return total || 1;
}

/**
 * The sessions with each one's makeup cut filled in (Session.makeupCut, read by profit()).
 * Sessions whose cut is unchanged keep their identity, so nothing re-renders for nothing.
 */
export function withCuts(sessions: Session[], packages: StakePackage[]): Session[] {
  if (!packages.length && !sessions.some((s) => s.makeupCut)) return sessions;
  const { cuts } = packageStates(sessions, packages);
  return sessions.map((s) => {
    const c = cuts.get(s.id);
    const v = c && Math.abs(c) >= 0.005 ? Math.round(c * 100) / 100 : undefined;
    return (s.makeupCut ?? undefined) === v ? s : { ...s, makeupCut: v };
  });
}

/**
 * One backer's piece of one session, as the steps a backer can check by hand:
 * the session, their share and markup, your makeup cut, what they get back.
 * Numbers only; the screen supplies the words.
 */
export function pieceSteps(r: BackerLedgerRow) {
  const s = r.session;
  const buyIns = cost(s);
  return {
    buyIns,
    prizeTotal: s.cashOut || 0,
    piece: pieceOf(s, r.stake),
    markup: r.stake.markup || 1,
    cost: r.cost,
    prize: r.prize,
    cut: r.cut,
    owed: r.owed,
    net: r.owed - r.cost,
    /** What this piece adds to the balance: what they get back, less what they haven't paid. */
    balance: r.owed - (r.stake.unpaid ? r.cost : 0),
  };
}
