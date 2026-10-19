// Bankrolls: which pot each session counts towards, deposits and withdrawals,
// balances, and the filters on the Bankroll tab. Pure, so it can be tested.
//
// Every amount is in one currency. A bankroll has one currency for life, and
// a view over several bankrolls only ever joins bankrolls in the same one.

import { t } from '@/i18n';
import { decimal, rawMoney } from '@/poker/format';
import type { GameKind } from '@/poker/types';

import { addDays, byCurrency, profit } from './session-math';
import type { Bankroll, GameFormat, Session, Transfer } from './types';

/** Stable id for the bankroll made automatically for a currency, so two phones (or a backup) agree on it. */
export function autoBankrollId(currency: string): string {
  return 'br_auto_' + [...currency].map((c) => c.codePointAt(0)!.toString(36)).join('_');
}

/**
 * Makes sure every currency with sessions has a bankroll (older data had
 * none), and that there is at least one. Returns the same array when nothing
 * was missing, so callers can skip a save.
 */
export function ensureBankrolls(list: Bankroll[], sessions: Session[], defaultCurrency: string, now = Date.now()): Bankroll[] {
  // Older builds could make two bankrolls with one id (see freeAutoId): keep the first.
  const ids = new Set(list.map((b) => b.id));
  const bankrolls = ids.size === list.length ? list : list.filter((b) => ids.delete(b.id));
  const have = new Set(bankrolls.map((b) => b.currency));
  const need = byCurrency(sessions)
    .map((g) => g.currency)
    .filter((c) => c && !have.has(c))
    // The player's own currency first, so it gets the "Main" name.
    .sort((a, b) => Number(b === defaultCurrency) - Number(a === defaultCurrency));
  if (!bankrolls.length && !need.length) need.push(defaultCurrency);
  if (!need.length) return bankrolls;
  const first = !bankrolls.length;
  const taken = new Set(bankrolls.map((b) => b.id));
  const made = need.map((currency, i) => ({
    id: freeAutoId(currency, taken),
    // The first one is just "Main"; any extra one says its currency.
    name: first && i === 0 ? t('Principal') : `Bankroll ${currency}`,
    currency,
    createdAt: now + i,
    updatedAt: 0,
  }));
  return [...bankrolls, ...made];
}

/**
 * The stable id for a currency, unless a bankroll in another currency already has it: before
 * the onboarding's currency pick made a new bankroll, it moved the first one to the new
 * currency and kept its id ("br_auto_€" in dollars). Then "_2", "_3"…, the same on every phone.
 */
function freeAutoId(currency: string, taken: Set<string>): string {
  const base = autoBankrollId(currency);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  taken.add(id);
  return id;
}

/** The id a bankroll takes on a phone that has its id in another currency: the same on every phone. */
export function sepId(id: string, currency: string): string {
  return `${id}~${autoBankrollId(currency).slice(8)}`;
}

/**
 * A backup (or the other phone) with a bankroll under the id of one here in another currency
 * (an older onboarding moved the first bankroll to a new currency and kept its id). One must
 * never write over the other: this phone's stays and the incoming one takes sepId(id, its
 * currency). One of this phone's coming back under that name gets its own id again, so two
 * phones copying to each other end with the same two bankrolls, never a new one per copy.
 * Its sessions (in its currency) and transfers follow it.
 */
export function separateBankrolls<B extends { bankrolls?: Bankroll[]; sessions: Session[]; transfers?: Transfer[] }>(local: Bankroll[], incoming: B): B {
  const mine = new Map(local.map((b) => [b.id, b.currency]));
  const to = (id: string, currency: string) => {
    const here = mine.get(id);
    if (here !== undefined && here !== currency) return sepId(id, currency);
    const cut = id.lastIndexOf('~');
    if (cut > 0 && id === sepId(id.slice(0, cut), currency) && mine.get(id.slice(0, cut)) === currency) return id.slice(0, cut);
    return id;
  };
  const list = incoming.bankrolls ?? [];
  const cur = new Map(list.map((b) => [b.id, b.currency]));
  // A session follows the bankroll it points at, in that bankroll's currency: one in another currency
  // stays a mismatch and counts where it did on the other phone (its currency's own bankroll).
  const sid = (x: Session) => (x.bankrollId ? to(x.bankrollId, cur.get(x.bankrollId) ?? x.currency) : undefined);
  if (!list.some((b) => to(b.id, b.currency) !== b.id) && !incoming.sessions.some((x) => sid(x) !== x.bankrollId)) return incoming;
  return {
    ...incoming,
    bankrolls: list.map((b) => (to(b.id, b.currency) !== b.id ? { ...b, id: to(b.id, b.currency) } : b)),
    sessions: incoming.sessions.map((x) => (sid(x) !== x.bankrollId ? { ...x, bankrollId: sid(x) } : x)),
    transfers: incoming.transfers?.map((x) => (cur.has(x.bankrollId) && to(x.bankrollId, cur.get(x.bankrollId)!) !== x.bankrollId ? { ...x, bankrollId: to(x.bankrollId, cur.get(x.bankrollId)!) } : x)),
  };
}

/**
 * A separated copy next to the bankroll it was made from, now in the same currency (this phone's
 * own one in the other currency went, unused): the same bankroll twice. The copy folds into it,
 * with the copy's name and rules when it was edited later; `to` says where its sessions and
 * transfers go. No delete mark: the other phone folds the same way.
 */
export function foldSeparated(bankrolls: Bankroll[]): { bankrolls: Bankroll[]; to: Map<string, string> } {
  const byId = new Map(bankrolls.map((b) => [b.id, b]));
  const to = new Map<string, string>();
  for (const b of bankrolls) {
    const cut = b.id.lastIndexOf('~');
    const base = cut > 0 ? byId.get(b.id.slice(0, cut)) : undefined;
    if (base && base.currency === b.currency && b.id === sepId(base.id, b.currency)) to.set(b.id, base.id);
  }
  if (!to.size) return { bankrolls, to };
  const out = bankrolls
    .filter((b) => !to.has(b.id))
    .map((b) => {
      const copy = bankrolls.find((x) => to.get(x.id) === b.id);
      return copy && (copy.updatedAt ?? 0) > (b.updatedAt ?? 0) ? { ...copy, id: b.id, currency: b.currency, createdAt: b.createdAt } : b;
    });
  return { bankrolls: out, to };
}

/** Sessions or transfers moved with foldSeparated. The same array when nothing moves. */
export function refold<T extends { bankrollId?: string }>(list: T[], to: Map<string, string>): T[] {
  if (!to.size || !list.some((x) => x.bankrollId && to.has(x.bankrollId))) return list;
  return list.map((x) => (x.bankrollId && to.has(x.bankrollId) ? { ...x, bankrollId: to.get(x.bankrollId)! } : x));
}

/**
 * Empty bankrolls that earlier copies between two phones multiplied (each copy gave the other
 * phone's a new id): of those with the same currency and name, made automatically and with no
 * session, transfer, rules or shot, one stays (the currency's own id, else the oldest) and the
 * rest go. One with sessions, a name of its own or the last of its currency never goes.
 * Returns the ids to drop.
 */
export function emptyDuplicates(bankrolls: Bankroll[], sessions: Session[], transfers: Transfer[], keep?: string): string[] {
  const used = new Set<string>(transfers.map((x) => x.bankrollId));
  for (const s of sessions) {
    const b = bankrollOf(s, bankrolls);
    if (b) used.add(b.id);
  }
  const groups = new Map<string, Bankroll[]>();
  for (const b of bankrolls) {
    if (!b.id.startsWith('br_auto_') || used.has(b.id) || b.rules || b.shot) continue;
    const k = `${b.currency}\n${b.name}`;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const rank = (b: Bankroll) => (b.id === keep ? 0 : b.id === autoBankrollId(b.currency) ? 1 : b.id.includes('~') ? 2 : 3);
  const drop: string[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const [stay] = [...g].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
    drop.push(...g.filter((b) => b !== stay).map((b) => b.id));
  }
  return drop;
}

/**
 * After a backup is merged in: the bankroll this phone made on its own (the
 * fresh install's "Principal") goes away when nothing on the phone uses it,
 * so restoring on a new phone doesn't leave two "Principal". One the player
 * renamed or used stays.
 */
export function dropUnusedAuto(merged: Bankroll[], incoming: Bankroll[], local: { bankrolls: Bankroll[]; sessions: Session[]; transfers: Transfer[] }): Bankroll[] {
  if (!incoming.length) return merged;
  const fromBackup = new Set(incoming.map((b) => b.id));
  const unused = unusedAuto(local);
  const out = merged.filter((b) => fromBackup.has(b.id) || !unused(b));
  return out.length ? out : merged;
}

/**
 * This phone's own "Principal", made on its own and never renamed or used. The onboarding's
 * currency pick moves it to that currency (a save, so it has an edit time): still the same
 * untouched "Principal", known by its id no longer matching its currency.
 */
function unusedAuto(local: { bankrolls: Bankroll[]; sessions: Session[]; transfers: Transfer[] }) {
  const used = new Set<string>();
  for (const x of local.sessions) {
    const b = bankrollOf(x, local.bankrolls);
    if (b) used.add(b.id);
  }
  for (const x of local.transfers) used.add(x.bankrollId);
  const untouched = (b: Bankroll) => !((b.updatedAt ?? 0) > 0) || (b.id !== autoBankrollId(b.currency) && b.name === t('Principal') && !b.rules && !b.shot);
  return (b: Bankroll) => b.id.startsWith('br_auto_') && untouched(b) && !used.has(b.id);
}

/**
 * How many of a backup's bankrolls the player gets back: new ids, plus the
 * one sharing an id with this phone's own empty "Principal" (same currency,
 * same stable id), which the backup's takes over.
 */
export function bankrollsBack(incoming: Bankroll[], local: { bankrolls: Bankroll[]; sessions: Session[]; transfers: Transfer[] }): number {
  const unused = unusedAuto(local);
  const mine = new Map(local.bankrolls.map((b) => [b.id, b]));
  return incoming.filter((b) => {
    const cur = mine.get(b.id);
    return !cur || unused(cur);
  }).length;
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

/** The bankroll a session counts towards. Unknown or missing id: its currency's own, else the first in its currency. */
export function bankrollOf(s: Pick<Session, 'bankrollId' | 'currency'>, bankrolls: Bankroll[]): Bankroll | null {
  const own = s.bankrollId ? bankrolls.find((b) => b.id === s.bankrollId) : undefined;
  if (own && own.currency === s.currency) return own;
  // The currency's own bankroll first: a restore can bring older ones that must not take its sessions.
  return bankrolls.find((b) => b.id === autoBankrollId(s.currency) && b.currency === s.currency) ?? sortBankrolls(bankrolls).find((b) => b.currency === s.currency) ?? null;
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
  if (key.startsWith('c:')) {
    // Blinds with cents (imported) read as money does: 0,25/0,50. Whole blinds stay 1/2.
    const [sb, bb] = key.slice(2).split('/').map(Number);
    const cents = [sb, bb].some((x) => Math.abs(x - Math.round(x)) > 1e-9);
    return cents ? `${decimal(sb, 2)}/${decimal(bb, 2)}` : key.slice(2);
  }
  const i = Number(key.slice(2));
  if (i === 0) return `≤${rawMoney(BANDS[0], currency)}`;
  if (i >= BANDS.length) return `>${rawMoney(BANDS[BANDS.length - 1], currency)}`;
  return `${BANDS[i - 1] + 1}–${rawMoney(BANDS[i], currency)}`;
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

/** The last millisecond of `ts`'s local day (a DST day is 23 or 25 hours, not 24). */
export function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function presetRange(p: Exclude<RangePreset, 'custom'>, now = Date.now()): DateRange {
  const d = new Date(now);
  switch (p) {
    case 'all':
      return {};
    case '30d':
      return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) };
    case '90d':
      return { from: startOfDay(addDays(now, -89)), to: endOfDay(now) };
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
