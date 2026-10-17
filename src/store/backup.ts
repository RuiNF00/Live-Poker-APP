// Backup format: one JSON with everything on the device. Used by the file
// export/import and by the cloud backup. Pure, so it can be tested.

import { t } from '@/i18n';
import type { Hand } from '@/poker/types';

import { cost, playedMs, profit, stakesOf, stakingSummary } from './session-math';
import { bankrollOf, formatOf } from './bankroll-math';
import type { Backer, BackerPayment, Bankroll, PlayerNote, Session, Settings, StakePackage, Transfer } from './types';

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
  /** Missing in backups made before bankrolls existed. */
  bankrolls?: Bankroll[];
  transfers?: Transfer[];
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
  const payments = arr('payments').filter((p) => isObj(p) && typeof p.backerId === 'string' && typeof p.amount === 'number') as unknown as BackerPayment[];
  const bankrolls = arr('bankrolls').filter((b) => isObj(b) && typeof b.name === 'string' && typeof b.currency === 'string' && typeof b.createdAt === 'number') as unknown as Bankroll[];
  const transfers = arr('transfers').filter(
    (x) => isObj(x) && typeof x.bankrollId === 'string' && (x.kind === 'deposit' || x.kind === 'withdrawal') && typeof x.amount === 'number' && Number.isFinite(x.amount) && typeof x.at === 'number',
  ) as unknown as Transfer[];
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
    bankrolls,
    transfers,
    settings: isObj(j.settings) ? (j.settings as Partial<Settings>) : undefined,
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

/** Sessions, then deposits and withdrawals, as CSV for spreadsheets and accountants. */
export function sessionsCsv(list: Session[], bankrolls: Bankroll[] = [], transfers: Transfer[] = []): string {
  const head = ['date', 'type', 'format', 'bankroll', 'game', 'venue', 'currency', 'hours', 'buy_in', 'entries', 'add_on', 'total_cost', 'cash_out', 'sold_pct', 'markup', 'expenses', 'profit', 'place', 'field', 'country', 'tax_withheld', 'tax_form', 'tax_status', 'notes'];
  const rows = list
    .filter((s) => s.endedAt)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) =>
      [
        new Date(s.startedAt).toISOString().slice(0, 10),
        s.kind,
        formatOf(s),
        bankrollOf(s, bankrolls)?.name ?? '',
        s.name,
        s.venue,
        s.currency,
        (playedMs(s) / 3600000).toFixed(2),
        s.buyIn,
        s.entries,
        s.addOn || 0,
        cost(s),
        s.cashOut || 0,
        stakingSummary(stakesOf(s))?.sold ?? 0,
        stakingSummary(stakesOf(s))?.markup ?? '',
        s.expenses ?? 0,
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
      row[0] = new Date(x.at).toISOString().slice(0, 10);
      row[1] = x.kind;
      row[head.indexOf('bankroll')] = b?.name ?? '';
      row[head.indexOf('currency')] = b?.currency ?? '';
      row[head.indexOf('profit')] = x.kind === 'deposit' ? Math.abs(x.amount) : -Math.abs(x.amount);
      row[head.indexOf('notes')] = x.note;
      return row.map(cell).join(',');
    });
  return [head.join(','), ...rows, ...moves].join('\n') + '\n';
}

/** "Novos: 3 mãos · 1 sessão · 0 jogadores. …" with the right plurals. */
export function importSummary(n: { hands: number; sessions: number; players: number; backers?: number; bankrolls?: number; transfers?: number }): string {
  const parts = [
    n.hands === 1 ? t('1 mão') : t('{n} mãos', { n: n.hands }),
    n.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: n.sessions }),
    n.players === 1 ? t('1 jogador') : t('{n} jogadores', { n: n.players }),
  ];
  if (n.backers) parts.push(n.backers === 1 ? t('1 backer') : t('{n} backers', { n: n.backers }));
  // Only when the backup had any: older backups have none to mention.
  if (n.bankrolls) parts.push(n.bankrolls === 1 ? t('1 bankroll') : t('{n} bankrolls', { n: n.bankrolls }));
  if (n.transfers) parts.push(n.transfers === 1 ? t('1 movimento') : t('{n} movimentos', { n: n.transfers }));
  return t('Novos: {list}. O que já tinhas ficou.', { list: parts.join(' · ') });
}
