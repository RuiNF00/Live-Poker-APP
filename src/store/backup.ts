// Backup format: one JSON with everything on the device. Used by the file
// export/import and by the cloud backup. Pure, so it can be tested.

import { t } from '@/i18n';
import { checkStatement } from '@/lib/backing-link';
import type { Festival, FestivalEvent } from '@/poker/festivals';
import type { Hand } from '@/poker/types';

import { cost, playedMs, profit, stakesOf, stakingSummary } from './session-math';
import { bankrollOf, formatOf } from './bankroll-math';
import type { FestivalPlan } from './festival-plan';
import type { WeeklyTournament } from './weekly';
import type { SwapGroup } from './swap-groups';
import { dayKey } from './fx-math';
import { isBagged } from './multi-day';
import { validSwapId, validSwapToken, type Swap } from './swaps';
import { fixHand, fixPlayer, fixSession, fixTrip } from './validate';
import type { BackedPlayer, Backer, BackerPayment, Bankroll, PlayerNote, Session, Settings, StakePackage, Transfer, Trip, Expense } from './types';
import { csvCell, type CsvSep } from '../export/csv';

export interface BackupData {
  app: 'sweatbook';
  v: 1;
  exportedAt: number;
  hands: Hand[];
  sessions: Session[];
  players: PlayerNote[];
  /** Staking (absent in copies made before it existed). */
  backers?: Backer[];
  packages?: StakePackage[];
  payments?: BackerPayment[];
  backing?: BackedPlayer[];
  /** Missing in backups made before bankrolls existed. */
  bankrolls?: Bankroll[];
  transfers?: Transfer[];
  /** Missing in backups made before trips existed. */
  trips?: Trip[];
  /** Swaps with this side's token, so a restored phone can still record prizes (absent before swaps). */
  swaps?: Swap[];
  /** Group swaps with this player's seat token (absent before group swaps). */
  swapGroups?: SwapGroup[];
  /** Festival plans by festival id, and the festivals the player added (absent before they were backed up). */
  festivalPlans?: Record<string, FestivalPlan>;
  ownFestivals?: Festival[];
  /** The player's weekly tournaments (absent before they were backed up). */
  weekly?: WeeklyTournament[];
  settings?: Partial<Settings>;
  /** Values set aside at launch because they couldn't be read ([quarantine key, raw value]), so a restore onto a fixed version can bring them back. */
  quarantine?: [string, string][];
}

/** Same prefix and item keys as boot.ts (kept here so backups don't import the store's loader; a test checks they match). */
export const QUARANTINE = 'rl.quarantine.v1.';
export const ITEM_PREFIX = { hands: 'rl.hand.v2.', sessions: 'rl.session.v2.', players: 'rl.player.v2.', trips: 'rl.trip.v1.' };

export function buildBackup(
  d: {
    hands: Hand[];
    sessions: Session[];
    players: PlayerNote[];
    bankrolls?: Bankroll[];
    transfers?: Transfer[];
    backers?: Backer[];
    packages?: StakePackage[];
    payments?: BackerPayment[];
    trips?: Trip[];
    backing?: BackedPlayer[];
    swaps?: Swap[];
    swapGroups?: SwapGroup[];
    festivalPlans?: Record<string, FestivalPlan>;
    ownFestivals?: Festival[];
    weekly?: WeeklyTournament[];
    settings: Settings;
    quarantine?: [string, string][];
  },
  now = Date.now(),
): BackupData {
  return {
    app: 'sweatbook',
    v: 1,
    exportedAt: now,
    hands: d.hands,
    sessions: d.sessions,
    players: d.players,
    bankrolls: d.bankrolls ?? [],
    transfers: d.transfers ?? [],
    backers: d.backers ?? [],
    packages: d.packages ?? [],
    payments: d.payments ?? [],
    trips: d.trips ?? [],
    backing: d.backing ?? [],
    swaps: d.swaps ?? [],
    swapGroups: d.swapGroups ?? [],
    festivalPlans: d.festivalPlans ?? {},
    ownFestivals: d.ownFestivals ?? [],
    weekly: d.weekly ?? [],
    settings: d.settings,
    ...(d.quarantine?.length ? { quarantine: d.quarantine } : {}),
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const withId = (x: unknown) => isObj(x) && typeof x.id === 'string' && x.id.length > 0;
const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Keys from a file: never one that would reach the object's prototype. */
const safeKey = (k: string) => k.length > 0 && k.length <= 100 && k !== '__proto__' && k !== 'constructor' && k !== 'prototype';

function okEvent(e: unknown): e is Record<string, unknown> {
  return withId(e) && isObj(e) && isStr(e.name) && isNum(e.number) && isNum(e.buyIn) && isStr(e.start) && (e.game === 'NLH' || e.game === 'PLO' || e.game === 'Mix');
}

/** Only the fields the planner knows; nothing else from the file is kept. */
function decodeEvent(e: Record<string, unknown>): FestivalEvent {
  return {
    id: (e.id as string).slice(0, 100),
    number: e.number as number,
    name: (e.name as string).slice(0, 80),
    ...(isStr(e.flight) ? { flight: e.flight.slice(0, 8) } : {}),
    ...(e.day2 === true ? { day2: true } : {}),
    ...(e.unnumbered === true ? { unnumbered: true } : {}),
    game: e.game as FestivalEvent['game'],
    buyIn: e.buyIn as number,
    guarantee: isNum(e.guarantee) ? e.guarantee : 0,
    start: (e.start as string).slice(0, 16),
    ...(e.own === true ? { own: true } : {}),
    ...(isNum(e.stack) ? { stack: e.stack } : {}),
    ...(isNum(e.levelMinutes) ? { levelMinutes: e.levelMinutes } : {}),
    ...(isNum(e.lateRegMin) ? { lateRegMin: e.lateRegMin } : {}),
  };
}

/** Only the shapes the planner reads; anything else in the file is dropped. */
function decodePlans(x: unknown): Record<string, FestivalPlan> {
  const out: Record<string, FestivalPlan> = {};
  if (!isObj(x)) return out;
  const strMap = <T>(m: unknown, ok: (v: unknown) => v is T): Record<string, T> => {
    const r: Record<string, T> = {};
    if (isObj(m)) for (const [k, v] of Object.entries(m)) if (safeKey(k) && ok(v)) r[k] = v;
    return r;
  };
  for (const [id, p] of Object.entries(x)) {
    if (!safeKey(id) || !isObj(p) || !Array.isArray(p.picked)) continue;
    const events = Array.isArray(p.events) ? (p.events as unknown[]).filter(okEvent).map(decodeEvent) : [];
    out[id] = {
      picked: (p.picked as unknown[]).filter(isStr),
      lateReg: strMap(p.lateReg, isNum),
      sessions: strMap(p.sessions, isStr),
      ...(isStr(p.name) ? { name: p.name.slice(0, 60) } : {}),
      ...(events.length ? { events } : {}),
    };
  }
  return out;
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Only the fields the Sessão tab reads, each checked. */
function decodeWeekly(x: unknown): WeeklyTournament[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((w): w is Record<string, unknown> => withId(w) && isObj(w) && isStr(w.name) && isStr(w.currency) && Number.isInteger(w.weekday) && (w.weekday as number) >= 0 && (w.weekday as number) <= 6 && isStr(w.time) && CLOCK.test(w.time) && isNum(w.buyIn))
    .map((w) => ({
      id: (w.id as string).slice(0, 100),
      name: (w.name as string).slice(0, 60),
      venue: isStr(w.venue) ? w.venue.slice(0, 80) : '',
      currency: (w.currency as string).slice(0, 8),
      weekday: w.weekday as number,
      time: w.time as string,
      buyIn: w.buyIn as number,
      ...(isNum(w.stack) ? { stack: w.stack } : {}),
      ...(isNum(w.levelMinutes) ? { levelMinutes: w.levelMinutes } : {}),
    }));
}

function decodeOwnFestivals(x: unknown): Festival[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((f): f is Record<string, unknown> => withId(f) && isObj(f) && f.own === true && isStr(f.name) && isStr(f.currency) && isObj(f.dates) && isStr(f.dates.from) && DAY.test(f.dates.from) && isStr(f.dates.to) && DAY.test(f.dates.to))
    .map((f) => {
      const dates = f.dates as { from: string; to: string };
      return {
        id: f.id as string,
        name: (f.name as string).slice(0, 60),
        venue: isStr(f.venue) ? f.venue.slice(0, 80) : '',
        city: isStr(f.city) ? f.city.slice(0, 80) : '',
        currency: f.currency as string,
        utcOffset: isNum(f.utcOffset) ? f.utcOffset : 0,
        ...(isStr(f.tz) && /^[A-Za-z_]+\/[\w/+-]{1,40}$/.test(f.tz) ? { tz: f.tz } : {}),
        source: { label: '', checked: isObj(f.source) && isStr(f.source.checked) ? f.source.checked : '' },
        notes: [],
        events: [],
        dates: { from: dates.from, to: dates.to },
        own: true,
      };
    });
}

/** Throws 'invalid' when the text isn't a Sweatbook backup. Drops malformed items. */
export function parseBackup(text: string): BackupData {
  let j: unknown;
  try {
    j = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('invalid');
  }
  // A later version that changed the format: refused as such (not as a broken file), nothing is read.
  if (isObj(j) && j.app === 'sweatbook' && isNum(j.v) && j.v > 1) throw new Error('newer');
  if (!isObj(j) || j.app !== 'sweatbook' || j.v !== 1) throw new Error('invalid');
  const arr = (k: string) => (Array.isArray(j[k]) ? (j[k] as unknown[]).filter(withId) : []);
  // The launch checks (validate.ts): an older copy gets the fields added since, one a screen
  // would crash on (no players, a hero who isn't seated) is left out, as at launch.
  // What fails goes to the same quarantine as at launch (keyed by where it would live, so a second
  // restore doesn't add it twice), not quietly away: a later version gets another go at it.
  const setAside: [string, string][] = [];
  const fixed = <T>(list: unknown[], fix: (x: unknown) => T | null, prefix: string) =>
    list
      .map((x) => {
        const ok = fix(x);
        const id = (x as { id: string }).id;
        if (!ok && !id.includes('\n')) setAside.push([`${QUARANTINE}backup.${prefix}${id}`, JSON.stringify(x)]);
        return ok;
      })
      .filter((x): x is T => x !== null);
  const hands = fixed(arr('hands'), fixHand, ITEM_PREFIX.hands);
  // A foreign or hand-edited backup may have no usable `breaks`: an empty list rather than losing the session.
  const sessions = fixed(
    arr('sessions').map((s) => (isObj(s) && !Array.isArray(s.breaks) ? { ...s, breaks: [] } : s)),
    fixSession,
    ITEM_PREFIX.sessions,
  );
  const players = fixed(arr('players'), (p) => (isObj(p) && typeof p.name === 'string' ? fixPlayer(p) : null), ITEM_PREFIX.players);
  const backers = arr('backers').filter((b) => isObj(b) && typeof b.name === 'string') as unknown as Backer[];
  const packages = arr('packages').filter((p) => isObj(p) && typeof p.backerId === 'string' && typeof p.share === 'number') as unknown as StakePackage[];
  const backing = arr('backing')
    .map((x) => (isObj(x) && typeof x.id === 'string' ? decodeBacked(x) : null))
    .filter((x): x is BackedPlayer => !!x);
  const payments = arr('payments').filter((p) => isObj(p) && typeof p.backerId === 'string' && typeof p.amount === 'number') as unknown as BackerPayment[];
  const bankrolls = arr('bankrolls').filter((b) => isObj(b) && typeof b.name === 'string' && typeof b.currency === 'string' && typeof b.createdAt === 'number') as unknown as Bankroll[];
  const transfers = arr('transfers').filter(
    (x) => isObj(x) && typeof x.bankrollId === 'string' && (x.kind === 'deposit' || x.kind === 'withdrawal') && typeof x.amount === 'number' && Number.isFinite(x.amount) && typeof x.at === 'number',
  ) as unknown as Transfer[];
  const tripOk = (x: unknown) => (isObj(x) && typeof x.name === 'string' && typeof x.currency === 'string' && typeof x.from === 'number' && typeof x.to === 'number' ? fixTrip(x) : null);
  const trips = (fixed(arr('trips'), tripOk, ITEM_PREFIX.trips) as unknown as Record<string, unknown>[])
    .map((x) => {
      const ex = Array.isArray(x.expenses) ? (x.expenses as unknown[]).filter((e) => withId(e) && isObj(e) && typeof e.amount === 'number' && Number.isFinite(e.amount) && typeof e.currency === 'string') : [];
      return { ...x, expenses: ex };
    }) as unknown as Trip[];
  const swaps = arr('swaps').filter(
    (x) => isObj(x) && validSwapId(x.id) && validSwapToken(x.token) && (x.side === 'a' || x.side === 'b') && isObj(x.terms) && Array.isArray(x.entries) && typeof x.createdAt === 'number',
  ) as unknown as Swap[];
  const swapGroups = arr('swapGroups').filter(
    (x) =>
      isObj(x) && validSwapId(x.id) && validSwapToken(x.token) && Number.isInteger(x.seat) && (x.seat as number) >= 0 && (x.seat as number) < 8 &&
      (x.invite === undefined || validSwapToken(x.invite)) && isObj(x.terms) && Array.isArray(x.seats) && Array.isArray(x.entries) && typeof x.createdAt === 'number',
  ) as unknown as SwapGroup[];
  return {
    app: 'sweatbook',
    v: 1,
    exportedAt: typeof j.exportedAt === 'number' ? j.exportedAt : 0,
    hands,
    sessions,
    players,
    backers,
    packages,
    payments,
    backing,
    bankrolls,
    transfers,
    trips,
    swaps,
    swapGroups,
    festivalPlans: decodePlans(j.festivalPlans),
    ownFestivals: decodeOwnFestivals(j.ownFestivals),
    weekly: decodeWeekly(j.weekly),
    settings: isObj(j.settings) ? (j.settings as Partial<Settings>) : undefined,
    // Only quarantine keys: a hand-made file must not be able to write any other key on restore.
    quarantine: [
      ...(Array.isArray(j.quarantine)
        ? (j.quarantine as unknown[]).filter((q): q is [string, string] => Array.isArray(q) && q.length === 2 && typeof q[0] === 'string' && q[0].startsWith(QUARANTINE) && !q[0].includes('\n') && typeof q[1] === 'string')
        : []),
      ...setAside,
    ].filter(([k], i, all) => all.findIndex(([x]) => x === k) === i),
  };
}

/**
 * Settings after a restore. On a phone with nothing on it yet (a new phone, a reinstall)
 * the backup's preferences come back: currency, default bankroll, privacy mode and the
 * rest. On a phone already in use, its own choices stay and only an empty nickname is filled.
 */
export function restoredSettings(cur: Settings, incoming: Partial<Settings> | undefined, fresh: boolean): Settings {
  if (!incoming) return cur;
  // Rates typed for currencies the ECB doesn't publish: without them sessions in those currencies lose their value at home.
  const rates = fxRates(incoming.fxManual);
  if (!fresh) {
    const fx = { ...rates, ...cur.fxManual };
    return { ...cur, nickname: cur.nickname || (typeof incoming.nickname === 'string' ? incoming.nickname : ''), ...(Object.keys(fx).length ? { fxManual: fx } : {}) };
  }
  const pick = <K extends keyof Settings>(k: K, ok: (v: unknown) => boolean): Partial<Settings> => (ok(incoming[k]) ? { [k]: incoming[k] } : {});
  const isStr = (v: unknown) => typeof v === 'string';
  const isBool = (v: unknown) => typeof v === 'boolean';
  return {
    ...cur,
    ...pick('currency', (v) => isStr(v) && (v as string).length > 0 && (v as string).length <= 4),
    ...pick('nickname', isStr),
    ...pick('inBB', isBool),
    ...pick('defaultTableSize', (v) => typeof v === 'number' && Number.isInteger(v) && v >= 2 && v <= 10),
    ...pick('shareNames', isBool),
    ...pick('shareNotes', isBool),
    ...pick('bankrollId', isStr),
    ...pick('hideAmounts', isBool),
    ...pick('includeSwaps', isBool),
    ...pick('mindAsk', isBool),
    ...pick('widgetResult', isBool),
    ...pick('haptics', isBool),
    ...pick('monthRecap', isBool),
    ...pick('notifyAmounts', isBool),
    ...pick('notifyHoldInSession', isBool),
    ...pick('icm', isBool),
    ...pick('streakPauses', (v) => Array.isArray(v) && v.every((p) => isObj(p) && isNum(p.from) && (p.to === undefined || isNum(p.to)))),
    ...pick('notify', (v) => isObj(v) && Object.entries(v).every(([k, x]) => /^[a-z]{1,20}$/.test(k) && isBool(x))),
    ...(Object.keys(rates).length ? { fxManual: rates } : {}),
    // Onboarding stays done: the restore itself happens after it.
    onboarded: cur.onboarded || incoming.onboarded === true,
  };
}

/** Units per 1 EUR by currency, from a file: only positive numbers under safe keys. */
function fxRates(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(x)) for (const [k, v] of Object.entries(x)) if (safeKey(k) && k.length <= 8 && isNum(v) && v > 0) out[k] = v;
  return out;
}

/** Union by id; the copy with the later updatedAt wins, ties keep the local one. */
export function mergeById<T extends { id: string; updatedAt?: number }>(local: T[], incoming: T[]): { list: T[]; added: number } {
  const byId = new Map(local.map((x) => [x.id, x]));
  let added = 0;
  for (const x of incoming) {
    const cur = byId.get(x.id);
    if (!cur) added++;
    if (!cur || (x.updatedAt ?? 0) > (cur.updatedAt ?? 0)) byId.set(x.id, x);
  }
  return { list: [...byId.values()], added };
}


/** Sessions, then deposits and withdrawals, then trip expenses, as CSV for spreadsheets and accountants. */
/** Local 'HH:MM': the date and time the player saw, not UTC (a 20:00 session in Nassau is not the next day). */
function clockOf(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Local 'YYYY-MM-DD HH:MM:SS'. */
function stampOf(ts: number): string {
  return `${dayKey(ts)} ${clockOf(ts)}:${String(new Date(ts).getSeconds()).padStart(2, '0')}`;
}

export function sessionsCsv(list: Session[], bankrolls: Bankroll[] = [], transfers: Transfer[] = [], expenses: { trip: Trip; x: Expense }[] = [], sep: CsvSep = ','): string {
  const cell = (v: string | number | undefined) => csvCell(v, sep);
  const head = ['date', 'start_time', 'type', 'format', 'bankroll', 'game', 'venue', 'currency', 'hours', 'hands', 'buy_in', 'entries', 'add_on', 'total_cost', 'cash_out', 'sold_pct', 'markup', 'expenses', 'tips', 'profit', 'swaps', 'makeup_cut', 'place', 'field', 'mtt_day', 'bagged_stack', 'country', 'tax_withheld', 'tax_form', 'tax_status', 'notes', 'started_at', 'ended_at', 'id'];
  const rows = list
    .filter((s) => s.endedAt)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) =>
      [
        dayKey(s.startedAt),
        clockOf(s.startedAt),
        s.kind,
        formatOf(s),
        bankrollOf(s, bankrolls)?.name ?? '',
        s.name,
        s.venue,
        s.currency,
        Math.round(playedMs(s) / 36000) / 100,
        s.handsDealt ?? '',
        s.buyIn,
        s.entries,
        s.addOn || 0,
        Math.round(cost(s) * 100) / 100,
        s.cashOut || 0,
        stakingSummary(stakesOf(s))?.sold ?? 0,
        stakingSummary(stakesOf(s))?.markup ?? '',
        s.expenses ?? 0,
        s.tips ?? 0,
        Math.round(profit(s) * 100) / 100,
        // Already inside profit when swaps count in results; listed so the number can be traced.
        s.swapNet ? Math.round(s.swapNet * 100) / 100 : '',
        // Same: in profit, apart so the import keeps cash_out as it was entered.
        (s.makeupCut ?? s.fileCut) ? Math.round((s.makeupCut ?? s.fileCut)! * 100) / 100 : '',
        s.finish,
        s.field,
        // Multi-day tournaments: the day it reached, and the stack while it waits in the bag.
        s.kind === 'mtt' && s.day && s.day > 1 ? s.day : '',
        isBagged(s) ? s.bag!.stack : '',
        s.country ?? '',
        s.withheld?.amount ?? '',
        s.withheld?.form ?? '',
        s.withheld ? s.withheld.status : '',
        s.notes,
        // For the import, not for people: the exact times (with breaks, hours alone loses the end) and the id,
        // so the same file imported again finds its sessions instead of doubling them.
        stampOf(s.startedAt),
        stampOf(s.endedAt!),
        s.id,
      ]
        .map(cell)
        .join(sep),
    );
  // Same columns: the type says what the row is, the amount is in profit.
  const moves = [...transfers]
    .sort((a, b) => a.at - b.at)
    .map((x) => {
      const b = bankrolls.find((r) => r.id === x.bankrollId);
      const row: (string | number | undefined)[] = head.map(() => '');
      row[0] = dayKey(x.at);
      row[head.indexOf('type')] = x.kind;
      row[head.indexOf('bankroll')] = b?.name ?? '';
      row[head.indexOf('currency')] = b?.currency ?? '';
      row[head.indexOf('profit')] = x.kind === 'deposit' ? Math.abs(x.amount) : -Math.abs(x.amount);
      row[head.indexOf('notes')] = x.note;
      row[head.indexOf('started_at')] = stampOf(x.at);
      row[head.indexOf('id')] = x.id;
      return row.map(cell).join(sep);
    });
  // Type "expense", the kind in notes before the player's note, the trip as the game.
  const spent = [...expenses]
    .sort((a, b) => a.x.at - b.x.at)
    .map(({ trip, x }) => {
      const row: (string | number | undefined)[] = head.map(() => '');
      row[0] = dayKey(x.at);
      row[head.indexOf('type')] = 'expense';
      row[head.indexOf('game')] = trip.name;
      row[head.indexOf('venue')] = trip.venue;
      row[head.indexOf('currency')] = x.currency;
      row[head.indexOf('profit')] = -Math.abs(x.amount);
      row[head.indexOf('notes')] = [x.kind, x.note].filter(Boolean).join(': ');
      return row.map(cell).join(sep);
    });
  return [head.join(sep), ...rows, ...moves, ...spent].join('\n') + '\n';
}

/** "Novos: 3 mãos · 1 sessão · 0 jogadores. …" with the right plurals. */
export function importSummary(n: {
  hands: number;
  sessions: number;
  players: number;
  backers?: number;
  bankrolls?: number;
  transfers?: number;
  trips?: number;
  packages?: number;
  payments?: number;
  backing?: number;
  swaps?: number;
}): string {
  const parts = [
    n.hands === 1 ? t('1 mão') : t('{n} mãos', { n: n.hands }),
    n.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: n.sessions }),
    n.players === 1 ? t('1 jogador') : t('{n} jogadores', { n: n.players }),
  ];
  if (n.backers) parts.push(n.backers === 1 ? t('1 backer') : t('{n} backers', { n: n.backers }));
  // Only when the backup had any: older backups have none to mention.
  if (n.bankrolls) parts.push(n.bankrolls === 1 ? t('1 bankroll') : t('{n} bankrolls', { n: n.bankrolls }));
  if (n.transfers) parts.push(n.transfers === 1 ? t('1 movimento') : t('{n} movimentos', { n: n.transfers }));
  if (n.trips) parts.push(n.trips === 1 ? t('1 viagem') : t('{n} viagens', { n: n.trips }));
  if (n.packages) parts.push(n.packages === 1 ? t('1 pacote de staking') : t('{n} pacotes de staking', { n: n.packages }));
  if (n.payments) parts.push(n.payments === 1 ? t('1 pagamento a backers') : t('{n} pagamentos a backers', { n: n.payments }));
  if (n.backing) parts.push(n.backing === 1 ? t('1 jogador que apoias') : t('{n} jogadores que apoias', { n: n.backing }));
  if (n.swaps) parts.push(n.swaps === 1 ? t('1 swap') : t('{n} swaps', { n: n.swaps }));
  return t('Novos: {list}. O que já tinhas ficou.', { list: parts.join(' · ') });
}

/** A backed player from a backup, with the statement re-checked like a fresh link. */
function decodeBacked(x: Record<string, unknown>): BackedPlayer | null {
  const st = isObj(x.statement) ? checkStatement(x.statement) : null;
  if (!st || st.id !== x.id) return null;
  return { id: st.id, statement: st, createdAt: typeof x.createdAt === 'number' ? x.createdAt : 0, ...(typeof x.updatedAt === 'number' ? { updatedAt: x.updatedAt } : {}) };
}
