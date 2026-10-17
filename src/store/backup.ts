// Backup format: one JSON with everything on the device. Used by the file
// export/import and by the cloud backup. Pure, so it can be tested.

import { t } from '@/i18n';
import { checkStatement } from '@/lib/backing-link';
import type { Hand } from '@/poker/types';

import { cost, playedMs, profit, stakesOf, stakingSummary } from './session-math';
import { bankrollOf, formatOf } from './bankroll-math';
import { dayKey } from './fx-math';
import type { Swap } from './swaps';
import type { BackedPlayer, Backer, BackerPayment, Bankroll, PlayerNote, Session, Settings, StakePackage, Transfer, Trip, Expense } from './types';

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
  settings?: Partial<Settings>;
}

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
    settings: Settings;
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
    settings: d.settings,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const withId = (x: unknown) => isObj(x) && typeof x.id === 'string' && x.id.length > 0;

/** Throws 'invalid' when the text isn't a Sweatbook backup. Drops malformed items. */
export function parseBackup(text: string): BackupData {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('invalid');
  }
  if (!isObj(j) || j.app !== 'sweatbook' || j.v !== 1) throw new Error('invalid');
  const arr = (k: string) => (Array.isArray(j[k]) ? (j[k] as unknown[]).filter(withId) : []);
  const hands = arr('hands').filter((h) => isObj(h) && Array.isArray(h.players) && Array.isArray(h.actions)) as unknown as Hand[];
  const sessions = arr('sessions').filter((s) => isObj(s) && typeof s.startedAt === 'number') as unknown as Session[];
  const players = arr('players').filter((p) => isObj(p) && typeof p.name === 'string') as unknown as PlayerNote[];
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
  const trips = arr('trips')
    .filter((x): x is Record<string, unknown> => isObj(x) && typeof x.name === 'string' && typeof x.currency === 'string' && typeof x.from === 'number' && typeof x.to === 'number')
    .map((x) => {
      const ex = Array.isArray(x.expenses) ? (x.expenses as unknown[]).filter((e) => withId(e) && isObj(e) && typeof e.amount === 'number' && Number.isFinite(e.amount) && typeof e.currency === 'string') : [];
      return { ...x, expenses: ex };
    }) as unknown as Trip[];
  const swaps = arr('swaps').filter(
    (x) => isObj(x) && typeof x.token === 'string' && (x.side === 'a' || x.side === 'b') && isObj(x.terms) && Array.isArray(x.entries) && typeof x.createdAt === 'number',
  ) as unknown as Swap[];
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
    settings: isObj(j.settings) ? (j.settings as Partial<Settings>) : undefined,
  };
}

/**
 * Settings after a restore. On a phone with nothing on it yet (a new phone, a reinstall)
 * the backup's preferences come back: currency, default bankroll, privacy mode and the
 * rest. On a phone already in use, its own choices stay and only an empty nickname is filled.
 */
export function restoredSettings(cur: Settings, incoming: Partial<Settings> | undefined, fresh: boolean): Settings {
  if (!incoming) return cur;
  if (!fresh) return { ...cur, nickname: cur.nickname || (typeof incoming.nickname === 'string' ? incoming.nickname : '') };
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
    // Onboarding stays done: the restore itself happens after it.
    onboarded: cur.onboarded || incoming.onboarded === true,
  };
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

function cell(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Sessions, then deposits and withdrawals, then trip expenses, as CSV for spreadsheets and accountants. */
/** Local 'HH:MM': the date and time the player saw, not UTC (a 20:00 session in Nassau is not the next day). */
function clockOf(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function sessionsCsv(list: Session[], bankrolls: Bankroll[] = [], transfers: Transfer[] = [], expenses: { trip: Trip; x: Expense }[] = []): string {
  const head = ['date', 'start_time', 'type', 'format', 'bankroll', 'game', 'venue', 'currency', 'hours', 'hands', 'buy_in', 'entries', 'add_on', 'total_cost', 'cash_out', 'sold_pct', 'markup', 'expenses', 'tips', 'profit', 'place', 'field', 'country', 'tax_withheld', 'tax_form', 'tax_status', 'notes'];
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
        (playedMs(s) / 3600000).toFixed(2),
        s.handsDealt ?? '',
        s.buyIn,
        s.entries,
        s.addOn || 0,
        cost(s),
        s.cashOut || 0,
        stakingSummary(stakesOf(s))?.sold ?? 0,
        stakingSummary(stakesOf(s))?.markup ?? '',
        s.expenses ?? 0,
        s.tips ?? 0,
        Math.round(profit(s) * 100) / 100,
        s.finish,
        s.field,
        s.country ?? '',
        s.withheld?.amount ?? '',
        s.withheld?.form ?? '',
        s.withheld ? s.withheld.status : '',
        s.notes,
      ]
        .map(cell)
        .join(','),
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
      return row.map(cell).join(',');
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
      return row.map(cell).join(',');
    });
  return [head.join(','), ...rows, ...moves, ...spent].join('\n') + '\n';
}

/** "Novos: 3 mãos · 1 sessão · 0 jogadores. …" with the right plurals. */
export function importSummary(n: { hands: number; sessions: number; players: number; backers?: number; bankrolls?: number; transfers?: number; trips?: number }): string {
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
  return t('Novos: {list}. O que já tinhas ficou.', { list: parts.join(' · ') });
}

/** A backed player from a backup, with the statement re-checked like a fresh link. */
function decodeBacked(x: Record<string, unknown>): BackedPlayer | null {
  const st = isObj(x.statement) ? checkStatement(x.statement) : null;
  if (!st || st.id !== x.id) return null;
  return { id: st.id, statement: st, createdAt: typeof x.createdAt === 'number' ? x.createdAt : 0, ...(typeof x.updatedAt === 'number' ? { updatedAt: x.updatedAt } : {}) };
}
