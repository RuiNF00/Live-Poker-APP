// Staking ledger: what each backer put in, what they are owed, their makeup and
// the balance between you. Pure, so it can be tested; screens call these with
// the store's lists.

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
    let cum = 0;
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
    st.net = cum;
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

export interface BackerLedgerRow {
  session: Session;
  stake: Stake;
  /** Their money in. */
  cost: number;
  /** What they get back from this session (prize share, less your makeup cut). 0 while it runs. */
  owed: number;
}

export interface BackerLedger {
  rows: BackerLedgerRow[];
  /** Their money in, over every session. */
  invested: number;
  /** Their result: owed minus invested, ended sessions only. */
  result: number;
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
): BackerLedger {
  const pkgOf = new Map(packages.map((p) => [p.id, p]));
  const rows: BackerLedgerRow[] = [];
  for (const s of sessions)
    for (const x of stakesOf(s)) {
      if (x.backerId !== backerId) continue;
      const pkg = x.packageId ? pkgOf.get(x.packageId) : undefined;
      let owed = s.endedAt ? stakePrize(s, x) : 0;
      // In a makeup deal your cut comes out of what they get back.
      if (s.endedAt && pkg?.kind === 'makeup') owed -= (pk.byPackage.get(`${pkg.id}:${s.id}`) ?? 0) * (pieceOf(s, x) / packagePiece(s, pkg.id));
      rows.push({ session: s, stake: x, cost: stakeCost(s, x), owed });
    }
  rows.sort((a, b) => byEnd(b.session, a.session));
  const done = rows.filter((r) => r.session.endedAt);
  const invested = rows.reduce((a, r) => a + r.cost, 0);
  const owed = done.reduce((a, r) => a + r.owed, 0);
  const unpaid = rows.filter((r) => r.stake.unpaid).reduce((a, r) => a + r.cost, 0);
  const paid = payments.filter((p) => p.backerId === backerId).reduce((a, p) => a + p.amount, 0);
  const makeup = packages.filter((p) => p.backerId === backerId && !p.closedAt).reduce((a, p) => a + (pk.states.get(p.id)?.makeup ?? 0), 0);
  return {
    rows,
    invested,
    result: owed - done.reduce((a, r) => a + r.cost, 0),
    unpaid,
    paid,
    balance: owed - unpaid - paid,
    makeup,
    live: rows.length - done.length,
  };
}

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
