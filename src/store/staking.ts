// Staking ledger: what each backer put in, what they are owed, their makeup and
// the balance between you. Pure, so it can be tested; screens call these with
// the store's lists.

import { rate, type ManualRates, type RateTable } from './fx-math';
import { cost, owedToBackers, pieceOf, profit, stakesOf, type Cuts } from './session-math';
import type { BackerPayment, Session, Stake, StakePackage } from './types';

const byEnd = (a: Session, b: Session) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt);
/** To the cent: what the player and the backer see, and what they add up. */
// Half cents always away from zero: 0.5 × 157.45 and 157.45 × 0.5 are not the same float.
const cents = (n: number) => Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100;

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
  /** What the amounts below are in: the package's currency, or its first session's. */
  currency: string;
  /** Sessions in another currency left out of the makeup for want of a rate (offline, never fetched). */
  unconverted: number;
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
  /** The package's running result before each session, in that session's currency, keyed the same (see keepCuts). */
  before: Map<string, number>;
}

/** Rates for sessions in another currency than their package's. Without them those sessions stay out of the makeup. */
export interface PackageFx {
  table: RateTable;
  manual?: ManualRates;
}

export function packageStates(sessions: Session[], packages: StakePackage[], fx: PackageFx = { table: {} }): PackageResult {
  const states = new Map<string, PackageState>();
  const cuts: Cuts = new Map();
  const byPackage = new Map<string, number>();
  const before = new Map<string, number>();
  // Each package's sessions, with that session's pieces in it (normally one).
  const byPkg = new Map<string, Map<string, { s: Session; xs: Stake[] }>>();
  for (const s of sessions)
    for (const x of stakesOf(s)) {
      if (!x.packageId) continue;
      const list = byPkg.get(x.packageId) ?? new Map<string, { s: Session; xs: Stake[] }>();
      const row = list.get(s.id) ?? { s, xs: [] };
      row.xs.push(x);
      list.set(s.id, row);
      byPkg.set(x.packageId, list);
    }
  for (const pkg of packages) {
    const rows = [...(byPkg.get(pkg.id)?.values() ?? [])].sort((a, b) => byEnd(a.s, b.s));
    // One currency per package: each session's money is converted to it at that day's rate,
    // and your cut converted back to the session's currency (never added across currencies).
    const currency = pkg.currency || rows.find((r) => r.s.currency)?.s.currency || '';
    const k = (s: Session) => (!s.currency || !currency || s.currency === currency ? 1 : rate(fx.table, s.currency, currency, s.startedAt, fx.manual));
    const st: PackageState = { pkg, currency, unconverted: 0, sessions: rows.length, live: 0, invested: 0, net: 0, makeup: 0, cut: 0 };
    // Makeup carried over from the previous package is won back first, like this package's own losses.
    const carried = pkg.kind === 'makeup' ? Math.max(0, pkg.makeupIn ?? 0) : 0;
    let cum = -carried;
    for (const { s, xs } of rows) {
      const r = k(s);
      if (r === null) {
        st.unconverted++;
        if (!s.endedAt) st.live++;
        continue;
      }
      st.invested += xs.reduce((a, x) => a + stakeCost(s, x), 0) * r;
      before.set(`${pkg.id}:${s.id}`, cum / r);
      if (!s.endedAt) {
        st.live++;
        continue;
      }
      // To the cent per piece, like the backer's rows: the makeup left is what their rows add up to.
      const net = xs.reduce((a, x) => a + cents(stakePrize(s, x)) - cents(stakeCost(s, x)), 0) * r;
      if (pkg.kind === 'makeup') {
        const c = (pkg.playerCut / 100) * (Math.max(0, cum + net) - Math.max(0, cum));
        // Per session in the session's own currency, like the rest of its money.
        byPackage.set(`${pkg.id}:${s.id}`, c / r);
        // Each backer's line rounded on its own (pieceCut); the session's cut is their sum,
        // so the player's result and the backers' rows always match.
        const lines = xs.reduce((a, x) => a + pieceCut(byPackage, s, x, pkg), 0);
        cuts.set(s.id, (cuts.get(s.id) ?? 0) + lines);
        st.cut += lines * r;
      }
      cum += net;
    }
    st.net = cum + carried;
    st.makeup = pkg.kind === 'makeup' ? Math.max(0, -cum) : 0;
    states.set(pkg.id, st);
  }
  return { states, cuts, byPackage, before };
}

/**
 * Closing a makeup package that still has makeup: the player and backer either
 * forgive it (it ends with the package) or carry it to a new package on the same
 * terms, where it is won back first. Returns the closed package and the new one.
 */
function nextName(name: string): string {
  const m = /^(.*) \((\d+)\)$/.exec(name);
  return m ? `${m[1]} (${Number(m[2]) + 1})` : `${name} (2)`;
}

/** `currency`: what `makeup` is in (the package state's), so the new package counts it in the same one. */
export function closePackage(p: StakePackage, makeup: number, carry: boolean, newId: string, now = Date.now(), currency?: string): { closed: StakePackage; next: StakePackage | null } {
  const closed = { ...p, closedAt: now };
  if (!carry || p.kind !== 'makeup' || makeup < 0.01) return { closed, next: null };
  const next: StakePackage = {
    id: newId,
    backerId: p.backerId,
    // "Outubro" → "Outubro (2)" → "Outubro (3)": the two packages stay apart in the list.
    name: nextName(p.name),
    kind: 'makeup',
    share: p.share,
    markup: p.markup,
    playerCut: p.playerCut,
    makeupIn: Math.round(makeup * 100) / 100,
    ...(currency || p.currency ? { currency: currency || p.currency } : {}),
    createdAt: now,
  };
  return { closed, next };
}

/**
 * The package closePackage carried this one's makeup to: same backer, made the instant this one
 * closed, starting with makeup. Reopening this one must undo that, or the makeup counts twice.
 */
export function carriedTo(p: StakePackage, packages: StakePackage[]): StakePackage | undefined {
  if (!p.closedAt || p.kind !== 'makeup') return undefined;
  return packages.find((q) => q.id !== p.id && q.backerId === p.backerId && q.kind === 'makeup' && (q.makeupIn ?? 0) > 0 && q.createdAt === p.closedAt);
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

/**
 * How far back the staking screens need rates: the oldest backed session or festival package (with
 * backers) in a currency other than home. A package's due is converted at its createdAt, so without
 * it a 165$ + 33€ backer never got rates and stayed «Sem câmbio» even online (Pronto P2, 19 Oct).
 */
export function stakingRatesSince(home: string, sessions: { stakes?: unknown[]; currency: string; startedAt: number }[], offers: { currency: string; at: number }[]): number | null {
  const at = [...sessions.filter((s) => s.stakes?.length && s.currency !== home).map((s) => s.startedAt), ...offers.filter((o) => o.currency !== home).map((o) => o.at)];
  return at.length ? Math.min(...at) : null;
}

/**
 * Festival action not yet in a session, onto a backer's ledger: what they owe for it (`due`) and what
 * comes back for events that went by unplayed (`back`), both in the festival's currency. Without a
 * rate it is never added in: it stays apart, in its own currency, and the screens show it as such.
 */
const offerDeals = new WeakSet<BackerLedger>();
export function addOfferDue(l: BackerLedger, currency: string, due: number, back: number, rateTo: (from: string, to: string) => number | null) {
  // A deal with no sessions is in its oldest festival's currency, paid or not (call this for every
  // line, oldest offer first): payments carry no currency, so they count in the one they were made in.
  // Settling the line must not move the deal to the fallback (QA P1, 19 Oct: «Deves 27,50€»).
  if (!l.rows.length && !offerDeals.has(l)) {
    offerDeals.add(l);
    l.currency = currency;
  }
  if (!due && !back) return;
  const x = rateTo(currency, l.currency);
  if (x === null) {
    const a = l.apart.find((y) => y.currency === currency) ?? l.apart[l.apart.push({ currency, unpaid: 0, balance: 0 }) - 1];
    a.unpaid += due;
    a.balance += back - due;
    return;
  }
  l.unpaid += due * x;
  l.balance += (back - due) * x;
}

/**
 * The rates this backer's festival packages convert at now, to keep with a payment (BackerPayment.fx):
 * a payment that squared them stays square on a phone with no rates (Pronto P2-B, 19 Oct).
 */
export function offerRatesNow(
  backerId: string,
  deal: string,
  offers: { id: string; festivalId: string; createdAt: number; lines: { backerId: string }[] }[],
  currencyOf: (festivalId: string) => string | undefined,
  rateAt: (from: string, to: string, at: number) => number | null,
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const o of offers) {
    const c = o.lines.some((l) => l.backerId === backerId) ? currencyOf(o.festivalId) : undefined;
    if (!c || c === deal) continue;
    const r = rateAt(c, deal, o.createdAt);
    if (r !== null) out[`${o.id}>${deal}`] = r;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The rate a payment kept for this package (offerRatesNow), the newest one; null when none did. */
export function savedOfferRate(payments: BackerPayment[], backerId: string, offerId: string, to: string): number | null {
  let best: { at: number; r: number } | null = null;
  for (const p of payments) {
    const r = p.backerId === backerId && p.fx && typeof p.fx === 'object' ? p.fx[`${offerId}>${to}`] : undefined;
    // From a backup too: only a real rate.
    if (typeof r === 'number' && Number.isFinite(r) && r > 0 && (!best || p.at >= best.at)) best = { at: p.at, r };
  }
  return best ? best.r : null;
}

/**
 * Currencies of festival action still apart for want of a rate (see addOfferDue). While there are
 * any, the backer is sent nothing: the text, the link and the fixed page would all show less than
 * they owe or are owed (Voz/Bankroll P2, 19 Oct).
 */
export function unconverted(l: BackerLedger): string[] {
  return l.apart.filter((a) => Math.abs(a.balance) >= 0.01 || Math.abs(a.unpaid) >= 0.01).map((a) => a.currency);
}

/**
 * What the backer's headline shows: the deal's balance or, with it square, the first festival
 * amount kept apart for want of a rate. «Acertado» is only said when nothing is owed either way
 * (Design P2, 19 Oct: «Acertado» above «Deve-te 7650Kč»).
 */
export function headlineOf(l: BackerLedger, currency: string): { balance: number; currency: string; apart: boolean } {
  if (Math.abs(l.balance) >= 0.01) return { balance: l.balance, currency, apart: false };
  const a = l.apart.find((x) => Math.abs(x.balance) >= 0.01);
  return a ? { balance: a.balance, currency: a.currency, apart: true } : { balance: 0, currency, apart: false };
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
  /** Festival action in a currency with no rate yet: kept apart in its own, never added to the totals here. */
  apart: { currency: string; unpaid: number; balance: number }[];
  /** Each payment's own currency, by payment id: `paid` below is them converted at the payment's day. */
  payCurrency: Record<string, string>;
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
  /** `deal`: with no sessions yet, the currency of their oldest festival package (addOfferDue). */
  fx: { table: RateTable; fallback: string; manual?: ManualRates; deal?: string } = { table: {}, fallback: '' },
): BackerLedger {
  const pkgOf = new Map(packages.map((p) => [p.id, p]));
  const rows: BackerLedgerRow[] = [];
  for (const s of sessions)
    for (const x of stakesOf(s)) {
      if (x.backerId !== backerId) continue;
      const pkg = x.packageId ? pkgOf.get(x.packageId) : undefined;
      // To the cent per row, so the backer's total is the sum of the rows shown.
      const prize = s.endedAt ? cents(stakePrize(s, x)) : 0;
      // In a makeup deal your cut comes out of what they get back.
      const cut = pieceCut(pk.byPackage, s, x, pkg);
      rows.push({ session: s, stake: x, cost: stakeCost(s, x), prize, cut, owed: prize - cut });
    }
  rows.sort((a, b) => byEnd(b.session, a.session));
  const currency = dealCurrency(rows) ?? fx.deal ?? fx.fallback;
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
  const invested = cents(rows.reduce((a, r) => a + cents(r.cost * k(r)), 0));
  const prizes = cents(done.reduce((a, r) => a + cents(r.prize * k(r)), 0));
  const cut = cents(done.reduce((a, r) => a + cents(r.cut * k(r)), 0));
  const owed = cents(prizes - cut);
  const unpaid = cents(rows.filter((r) => r.stake.unpaid).reduce((a, r) => a + cents(r.cost * k(r)), 0));
  // Each payment in its own currency, at that day's rate: a bigger session in another currency later
  // moves the deal, never what was paid (QA P1, 19 Oct: «Deve-te 5090,91$» for a 909,09€ payment).
  const payCurrency: Record<string, string> = {};
  const paid = cents(
    payments
      .filter((p) => p.backerId === backerId)
      .reduce((a, p) => {
        const c = paymentCurrency(p, rows, fx.deal ?? currency);
        payCurrency[p.id] = c;
        if (c === currency) return a + p.amount;
        const x = rate(fx.table, c, currency, p.at, fx.manual);
        if (x === null) missing.add(c);
        return a + cents(p.amount * (x ?? 1));
      }, 0),
  );
  // Each package's makeup is in its own currency: converted to the deal's at today's rate.
  const makeup = packages
    .filter((p) => p.backerId === backerId && !p.closedAt)
    .reduce((a, p) => {
      const st = pk.states.get(p.id);
      if (!st?.makeup) return a;
      if (!st.currency || st.currency === currency) return a + st.makeup;
      const x = rate(fx.table, st.currency, currency, Date.now(), fx.manual);
      if (x === null) missing.add(st.currency);
      return a + st.makeup * (x ?? 1);
    }, 0);
  return {
    rows,
    currency,
    missing: [...missing],
    apart: [],
    payCurrency,
    invested,
    result: cents(owed - done.reduce((a, r) => a + cents(r.cost * k(r)), 0)),
    prizes,
    cut,
    owed,
    unpaid,
    paid,
    balance: cents(owed - unpaid - paid),
    makeup,
    live: rows.length - done.length,
  };
}

/**
 * The currency a payment was made in. Older ones kept none: the deal's as it stood on the day, from the
 * sessions started by then (with none, `before`: their festival's, or the deal's now).
 */
export function paymentCurrency(p: BackerPayment, rows: BackerLedgerRow[], before: string): string {
  if (typeof p.currency === 'string' && p.currency) return p.currency;
  return dealCurrency(rows.filter((r) => r.session.startedAt <= p.at)) ?? before;
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

/** One package's year with a backer (or the pieces sold outside a package: id null). */
export interface YearPackage {
  id: string | null;
  name: string;
  sessions: number;
  /** Their money in. */
  cost: number;
  /** What they got back: their prize shares less your makeup cut (ended sessions). */
  prizes: number;
  /** Their result: what they got back less what the ended sessions cost them. */
  net: number;
  /** Makeup still to win back, if the package is open. */
  makeup: number;
}

/** The years with sessions for this backer, newest first. */
export function ledgerYears(l: BackerLedger): number[] {
  return [...new Set(l.rows.map((r) => new Date(r.session.startedAt).getFullYear()))].sort((a, b) => b - a);
}

/**
 * Everything with one backer in one year, package by package: their buy-ins, what
 * they got back, their result and the makeup left. Sessions count in the year they
 * started. `k` converts a session's money to the ledger's currency.
 */
export function yearStatement(
  l: BackerLedger,
  year: number,
  packages: StakePackage[],
  pk: PackageResult,
  k: (s: Session) => number = () => 1,
  /** A package's makeup (in its own currency) in the ledger's. */
  km: (amount: number, currency: string) => number = (a) => a,
) {
  const pkgOf = new Map(packages.map((p) => [p.id, p]));
  const by = new Map<string, YearPackage>();
  for (const r of l.rows) {
    const s = r.session;
    if (new Date(s.startedAt).getFullYear() !== year) continue;
    const id = r.stake.packageId && pkgOf.has(r.stake.packageId) ? r.stake.packageId : null;
    const key = id ?? '';
    const p = id ? pkgOf.get(id)! : null;
    const y = by.get(key) ?? { id, name: p?.name ?? '', sessions: 0, cost: 0, prizes: 0, net: 0, makeup: p && !p.closedAt ? makeupOf(pk, p.id, l.currency, km) : 0 };
    const x = k(s);
    y.sessions++;
    y.cost += r.cost * x;
    if (s.endedAt) {
      y.prizes += r.owed * x;
      y.net += (r.owed - r.cost) * x;
    }
    by.set(key, y);
  }
  // Packages in the order they started; pieces outside a package last.
  const rows = [...by.values()].sort((a, b) => (a.id ? (pkgOf.get(a.id)?.createdAt ?? 0) : Infinity) - (b.id ? (pkgOf.get(b.id)?.createdAt ?? 0) : Infinity));
  const sum = (f: (y: YearPackage) => number) => rows.reduce((a, y) => a + f(y), 0);
  return {
    year,
    currency: l.currency,
    rows,
    sessions: sum((y) => y.sessions),
    cost: sum((y) => y.cost),
    prizes: sum((y) => y.prizes),
    net: sum((y) => y.net),
    makeup: sum((y) => y.makeup),
  };
}

export type YearStatement = ReturnType<typeof yearStatement>;

function makeupOf(pk: PackageResult, id: string, currency: string, km: (amount: number, currency: string) => number): number {
  const st = pk.states.get(id);
  if (!st?.makeup) return 0;
  return !st.currency || st.currency === currency ? st.makeup : km(st.makeup, st.currency);
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
  let rough = false;
  for (const l of ledgers) {
    // What has no rate stays in its own currency: shown apart (split), never added in as if 1:1.
    for (const [c, b] of [[l.currency || home, l.balance] as const, ...l.apart.map((a) => [a.currency, a.balance] as const)]) {
      const acc = per.get(c) ?? { owe: 0, owed: 0 };
      acc.owe += Math.max(0, b);
      acc.owed += Math.max(0, -b);
      per.set(c, acc);
    }
    if (l.missing.length) rough = true;
    const b = [l.balance, ...l.apart.map((a) => a.balance)];
    if (b.some((x) => x >= 0.01)) oweTo++;
    if (b.some((x) => x <= -0.01)) owedBy++;
  }
  const byCurrency = [...per.entries()].map(([currency, acc]) => ({ currency, ...acc })).filter((x) => x.owe >= 0.01 || x.owed >= 0.01);
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
    /** Totals converted from other currencies at today's rate, or with sessions counted 1:1 for want of one. */
    approx: convertible && (rough || byCurrency.some((x) => x.currency !== cur)),
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
 * The cut of a piece whose package was deleted: the package's rule kept on the piece (Stake.cutPct,
 * Stake.cumBefore), worked out again from the session as it is now, so editing the prize or the
 * buy-in still moves it. Same formula as packageStates, clawback included. Limit: a later session of
 * that package keeps the running result it had, since the package is gone and nothing carries an
 * edit forward. A piece with only a kept amount (Stake.cut) keeps that.
 */
function goneCut(s: Session, x: Stake): number {
  if (x.cutPct === undefined || x.cumBefore === undefined) return x.cut ?? 0;
  const net = cents(stakePrize(s, x)) - cents(stakeCost(s, x));
  return cents((x.cutPct / 100) * (Math.max(0, x.cumBefore + net) - Math.max(0, x.cumBefore)));
}

/** Your makeup cut out of one piece, to the cent, in its session's currency (ended sessions only). */
function pieceCut(byPackage: PackageResult['byPackage'], s: Session, x: Stake, pkg: StakePackage | undefined): number {
  if (!s.endedAt) return 0;
  if (!x.packageId) return goneCut(s, x);
  return pkg?.kind === 'makeup' ? cents((byPackage.get(`${pkg.id}:${s.id}`) ?? 0) * (pieceOf(s, x) / packagePiece(s, pkg.id))) : 0;
}

const hasGoneCut = (x: Stake) => !x.packageId && (x.cut !== undefined || x.cutPct !== undefined);

/** The cuts of a session's pieces whose package is gone. */
function keptCut(s: Session): number {
  return s.endedAt ? stakesOf(s).reduce((a, x) => a + (hasGoneCut(x) ? goneCut(s, x) : 0), 0) : 0;
}

/**
 * Deleting packages (or their backer): each piece in them keeps the cut it gave you (Stake.cut)
 * and loses the package, so past results stay as they were. The new stakes of each session
 * touched, by session id.
 */
export function keepCuts(sessions: Session[], packages: StakePackage[], gone: Set<string>, fx?: PackageFx): Map<string, Stake[]> {
  const out = new Map<string, Stake[]>();
  const hit = sessions.filter((s) => s.stakes?.some((x) => x.packageId && gone.has(x.packageId)));
  if (!hit.length) return out;
  const pkgOf = new Map(packages.map((p) => [p.id, p]));
  const pk = packageStates(sessions, packages.filter((p) => gone.has(p.id)), fx);
  for (const s of hit)
    out.set(
      s.id,
      s.stakes!.map((x) => {
        if (!x.packageId || !gone.has(x.packageId)) return x;
        const { packageId: _, ...rest } = x;
        const pkg = pkgOf.get(x.packageId);
        if (pkg?.kind !== 'makeup') return rest;
        // The package's rule for this piece, so the cut follows later edits of the session.
        const cumBefore = (pk.before.get(`${pkg.id}:${s.id}`) ?? 0) * (pieceOf(s, x) / packagePiece(s, pkg.id));
        return { ...rest, cutPct: pkg.playerCut, cumBefore: cumBefore || 0 };
      }),
    );
  return out;
}

/**
 * The sessions with each one's makeup cut filled in (Session.makeupCut, read by profit()):
 * the packages' cut plus any kept from deleted ones.
 * Sessions whose cut is unchanged keep their identity, so nothing re-renders for nothing.
 */
export function withCuts(sessions: Session[], packages: StakePackage[], fx?: PackageFx): Session[] {
  if (!packages.length && !sessions.some((s) => s.makeupCut || stakesOf(s).some(hasGoneCut))) return sessions;
  const { cuts } = packageStates(sessions, packages, fx);
  return sessions.map((s) => {
    const c = cuts.get(s.id);
    const all = (c && Math.abs(c) >= 0.005 ? cents(c) : 0) + keptCut(s);
    const v = Math.abs(all) >= 0.005 ? cents(all) : undefined;
    return (s.makeupCut ?? undefined) === v ? s : { ...s, makeupCut: v };
  });
}

/**
 * The end-of-session sheet before saving: what goes to the backers and the player's result with this
 * prize. A makeup package's cut depends on it, so it is worked out as the store will once saved,
 * and kept back from the backers' amount (2000 prize, 500 cut: 1500 to pay, +500 for me).
 */
export function endPreview(running: Session, sessions: Session[], packages: StakePackage[], now = Date.now()): { owed: number; profit: number } {
  // Ended as of now: only ended sessions count in a package.
  const ended = { ...running, endedAt: running.endedAt ?? now };
  const end = ended.stakes?.some((x) => x.packageId) ? (withCuts(sessions.map((x) => (x.id === ended.id ? ended : x)), packages).find((x) => x.id === ended.id) ?? ended) : ended;
  return { owed: Math.round((owedToBackers(end) - (end.makeupCut ?? 0)) * 100) / 100, profit: profit(end) };
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

/**
 * What a new package with this backer starts from: the terms of their most
 * recent package (deals rarely change between series), named after the trip
 * the player is on when there is one.
 */
export function packageDefaults(backerId: string, packages: StakePackage[], tripName = ''): Pick<StakePackage, 'kind' | 'share' | 'markup' | 'playerCut' | 'name'> {
  const last = packages.filter((p) => p.backerId === backerId).sort((a, b) => b.createdAt - a.createdAt)[0];
  return last
    ? { kind: last.kind, share: last.share, markup: last.markup, playerCut: last.playerCut, name: tripName }
    : { kind: 'action', share: 20, markup: 1.1, playerCut: 50, name: tripName };
}

/** The % and markup last sold to this backer outside a package, and whether they paid on the spot. */
export function lastStakeTerms(backerId: string, sessions: Session[]): { share: number; markup: number; unpaid: boolean } | null {
  let best: { at: number; x: Stake } | null = null;
  for (const s of sessions)
    for (const x of s.stakes ?? []) if (x.backerId === backerId && !x.packageId && (!best || s.startedAt > best.at)) best = { at: s.startedAt, x };
  return best ? { share: best.x.share, markup: best.x.markup || 1, unpaid: !!best.x.unpaid } : null;
}
