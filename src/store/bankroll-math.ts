// Bankrolls: which pot each session counts towards, deposits and withdrawals,
// balances, and the filters on the Bankroll tab. Pure, so it can be tested.
//
// Every amount is in one currency. A bankroll has one currency for life, and
// a view over several bankrolls only ever joins bankrolls in the same one.

import { t } from '@/i18n';
import { money } from '@/poker/format';
import type { GameKind } from '@/poker/types';

import { byCurrency, profit } from './session-math';
import type { Bankroll, GameFormat, Session, Transfer } from './types';

const DAY = 86400000;

/** Stable id for the bankroll made automatically for a currency, so two phones (or a backup) agree on it. */
export function autoBankrollId(currency: string): string {
  return 'br_auto_' + [...currency].map((c) => c.codePointAt(0)!.toString(36)).join('_');
}

/**
 * Makes sure every currency with sessions has a bankroll (older data had
 * none), and that there is at least one. Returns the same array when nothing
 * was missing, so callers can skip a save.
 */
export function ensureBankrolls(bankrolls: Bankroll[], sessions: Session[], defaultCurrency: string, now = Date.now()): Bankroll[] {
  const have = new Set(bankrolls.map((b) => b.currency));
  const need = byCurrency(sessions)
    .map((g) => g.currency)
    .filter((c) => c && !have.has(c))
    // The player's own currency first, so it gets the "Main" name.
    .sort((a, b) => Number(b === defaultCurrency) - Number(a === defaultCurrency));
  if (!bankrolls.length && !need.length) need.push(defaultCurrency);
  if (!need.length) return bankrolls;
  const first = !bankrolls.length;
  const made = need.map((currency, i) => ({
    id: autoBankrollId(currency),
    // The first one is just "Main"; any extra one says its currency.
    name: first && i === 0 ? t('Principal') : `Bankroll ${currency}`,
    currency,
    createdAt: now + i,
    updatedAt: 0,
  }));
  return [...bankrolls, ...made];
}

/**
 * The ones made automatically for older data ("Principal") first, then by
 * creation. An import brings bankrolls created before the auto one was made
 * on this phone; they must not jump ahead of it.
 */
export function sortBankrolls(list: Bankroll[]): Bankroll[] {
  const auto = (b: Bankroll) => (b.id.startsWith('br_auto_') ? 0 : 1);
  return [...list].sort((a, b) => auto(a) - auto(b) || a.createdAt - b.createdAt);
}

/** The bankroll a session counts towards. Unknown or missing id: the first bankroll in its currency. */
export function bankrollOf(s: Pick<Session, 'bankrollId' | 'currency'>, bankrolls: Bankroll[]): Bankroll | null {
  const own = s.bankrollId ? bankrolls.find((b) => b.id === s.bankrollId) : undefined;
  if (own && own.currency === s.currency) return own;
  return sortBankrolls(bankrolls).find((b) => b.currency === s.currency) ?? null;
}

export function formatOf(s: Pick<Session, 'format'>): GameFormat {
  return s.format === 'online' ? 'online' : 'live';
}

/** What the Bankroll tab is looking at: one bankroll, or every bankroll in a currency. */
export type Scope = { bankrollId: string } | { currency: string };

export function scopeCurrency(scope: Scope, bankrolls: Bankroll[]): string | null {
  if ('currency' in scope) return scope.currency;
  return bankrolls.find((b) => b.id === scope.bankrollId)?.currency ?? null;
}

export function scopeIds(scope: Scope, bankrolls: Bankroll[]): Set<string> {
  if ('bankrollId' in scope) return new Set(bankrolls.some((b) => b.id === scope.bankrollId) ? [scope.bankrollId] : []);
  return new Set(bankrolls.filter((b) => b.currency === scope.currency).map((b) => b.id));
}

export function sameScope(a: Scope, b: Scope): boolean {
  return 'bankrollId' in a ? 'bankrollId' in b && a.bankrollId === b.bankrollId : 'currency' in b && a.currency === b.currency;
}

export interface ScopeOption {
  scope: Scope;
  label: string;
  currency: string;
}

/** Each bankroll, plus "All €" for any currency with two or more. */
export function scopeOptions(bankrolls: Bankroll[]): ScopeOption[] {
  const out: ScopeOption[] = [];
  for (const g of byCurrency(sortBankrolls(bankrolls))) {
    if (g.items.length > 1) out.push({ scope: { currency: g.currency }, label: t('Todas {currency}', { currency: g.currency }), currency: g.currency });
    for (const b of g.items) out.push({ scope: { bankrollId: b.id }, label: b.name, currency: b.currency });
  }
  return out;
}

/** Sessions counting towards the scope (any state). */
export function sessionsIn(scope: Scope, sessions: Session[], bankrolls: Bankroll[]): Session[] {
  const ids = scopeIds(scope, bankrolls);
  return sessions.filter((s) => {
    const b = bankrollOf(s, bankrolls);
    return !!b && ids.has(b.id);
  });
}

export function transfersIn(scope: Scope, transfers: Transfer[], bankrolls: Bankroll[]): Transfer[] {
  const ids = scopeIds(scope, bankrolls);
  return transfers.filter((x) => ids.has(x.bankrollId));
}

export function signed(x: Transfer): number {
  return x.kind === 'deposit' ? Math.abs(x.amount) : -Math.abs(x.amount);
}

export interface Balance {
  /** What's in the bankroll now: deposits − withdrawals + results. */
  balance: number;
  deposits: number;
  withdrawals: number;
  /** Results of finished sessions. */
  results: number;
}

/** Real money in the scope. Filters don't apply: the balance is the balance. */
export function balanceOf(scope: Scope, sessions: Session[], transfers: Transfer[], bankrolls: Bankroll[]): Balance {
  const tx = transfersIn(scope, transfers, bankrolls);
  const deposits = tx.filter((x) => x.kind === 'deposit').reduce((a, x) => a + Math.abs(x.amount), 0);
  const withdrawals = tx.filter((x) => x.kind === 'withdrawal').reduce((a, x) => a + Math.abs(x.amount), 0);
  const results = sessionsIn(scope, sessions, bankrolls)
    .filter((s) => s.endedAt)
    .reduce((a, s) => a + profit(s), 0);
  return { balance: deposits - withdrawals + results, deposits, withdrawals, results };
}

/** Balance over time (transfers and finished sessions), oldest first. */
export function balanceCurve(scope: Scope, sessions: Session[], transfers: Transfer[], bankrolls: Bankroll[]): { t: number; v: number }[] {
  const ev = [
    ...transfersIn(scope, transfers, bankrolls).map((x) => ({ t: x.at, d: signed(x) })),
    ...sessionsIn(scope, sessions, bankrolls)
      .filter((s) => s.endedAt)
      .map((s) => ({ t: s.endedAt!, d: profit(s) })),
  ].sort((a, b) => a.t - b.t);
  let acc = 0;
  return [{ t: ev[0]?.t ?? Date.now(), v: 0 }, ...ev.map((e) => ({ t: e.t, v: (acc += e.d) }))];
}

// ---- Stakes ----------------------------------------------------------------

/** Tournament buy-in bands (upper bounds, inclusive). */
const BANDS = [50, 150, 500, 1500];

/** Cash: the blinds ("c:1/2"). Tournaments: a buy-in band ("m:1"). */
export function stakeKey(s: Pick<Session, 'kind' | 'sb' | 'bb' | 'buyIn'>): string {
  if (s.kind === 'cash') return `c:${s.sb}/${s.bb}`;
  const i = BANDS.findIndex((top) => s.buyIn <= top);
  return `m:${i < 0 ? BANDS.length : i}`;
}

export function stakeLabel(key: string, currency: string): string {
  if (key.startsWith('c:')) return key.slice(2);
  const i = Number(key.slice(2));
  if (i === 0) return `≤${money(BANDS[0], currency)}`;
  if (i >= BANDS.length) return `>${money(BANDS[BANDS.length - 1], currency)}`;
  return `${BANDS[i - 1] + 1}–${money(BANDS[i], currency)}`;
}

export interface StakeOption {
  key: string;
  kind: GameKind;
  label: string;
  sessions: number;
}

/** Stakes present in the list: cash by blinds (smallest first), then tournament bands. */
export function stakeOptions(list: Session[], currency: string): StakeOption[] {
  const m = new Map<string, StakeOption>();
  for (const s of list) {
    if (!s.endedAt) continue;
    const key = stakeKey(s);
    const o = m.get(key) ?? { key, kind: s.kind, label: stakeLabel(key, currency), sessions: 0 };
    o.sessions++;
    m.set(key, o);
  }
  const rank = (k: string) => (k.startsWith('c:') ? Number(k.split('/')[1]) || 0 : 1e9 + Number(k.slice(2)));
  return [...m.values()].sort((a, b) => rank(a.key) - rank(b.key));
}

// ---- Dates -----------------------------------------------------------------

export type RangePreset = 'all' | '30d' | '90d' | 'month' | 'lastMonth' | 'year' | 'custom';

export interface DateRange {
  /** Inclusive, start of a day. */
  from?: number;
  /** Inclusive, end of a day. */
  to?: number;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ts: number): number {
  return startOfDay(ts) + DAY - 1;
}

export function presetRange(p: Exclude<RangePreset, 'custom'>, now = Date.now()): DateRange {
  const d = new Date(now);
  switch (p) {
    case 'all':
      return {};
    case '30d':
      return { from: startOfDay(now - 29 * DAY), to: endOfDay(now) };
    case '90d':
      return { from: startOfDay(now - 89 * DAY), to: endOfDay(now) };
    case 'month':
      return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: endOfDay(now) };
    case 'lastMonth':
      return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: new Date(d.getFullYear(), d.getMonth(), 1).getTime() - 1 };
    case 'year':
      return { from: new Date(d.getFullYear(), 0, 1).getTime(), to: endOfDay(now) };
  }
}

export function inRange(ts: number, r: DateRange): boolean {
  return (r.from === undefined || ts >= r.from) && (r.to === undefined || ts <= r.to);
}

// ---- Filters ---------------------------------------------------------------

export interface SessionFilter {
  game: 'all' | GameKind;
  format: 'all' | GameFormat;
  /** Stake keys; empty = every stake. */
  stakes: string[];
  range: DateRange;
}

export const NO_FILTER: SessionFilter = { game: 'all', format: 'all', stakes: [], range: {} };

export function applyFilter(list: Session[], f: SessionFilter): Session[] {
  return list.filter(
    (s) =>
      (f.game === 'all' || s.kind === f.game) &&
      (f.format === 'all' || formatOf(s) === f.format) &&
      (!f.stakes.length || f.stakes.includes(stakeKey(s))) &&
      inRange(s.startedAt, f.range),
  );
}

/** Filters that are on, for the "n filters" badge. */
export function activeFilters(f: SessionFilter): number {
  return (f.game !== 'all' ? 1 : 0) + (f.format !== 'all' ? 1 : 0) + (f.stakes.length ? 1 : 0) + (f.range.from !== undefined || f.range.to !== undefined ? 1 : 0);
}

// ---- Bankroll changes ------------------------------------------------------

/** Sessions of a bankroll being deleted move to another one in the same currency. */
export function moveSessions(sessions: Session[], fromId: string, to: Bankroll, bankrolls: Bankroll[]): Session[] {
  return sessions.filter((s) => bankrollOf(s, bankrolls)?.id === fromId).map((s) => ({ ...s, bankrollId: to.id }));
}

/** Newest first: sessions and transfers of the scope as one history. */
export type LedgerEntry = { t: number; session: Session } | { t: number; transfer: Transfer };

export function ledger(sessions: Session[], transfers: Transfer[]): LedgerEntry[] {
  return [
    ...sessions.filter((s) => s.endedAt).map((s) => ({ t: s.startedAt, session: s })),
    ...transfers.map((x) => ({ t: x.at, transfer: x })),
  ].sort((a, b) => b.t - a.t);
}
