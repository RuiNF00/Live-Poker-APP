// Backup format: one JSON with everything on the device. Used by the file
// export/import and by the cloud backup. Pure, so it can be tested.

import { t } from '@/i18n';
import type { Hand } from '@/poker/types';

import { cost, playedMs, profit } from './session-math';
import type { PlayerNote, Session, Settings } from './types';

export interface BackupData {
  app: 'sweatbook';
  v: 1;
  exportedAt: number;
  hands: Hand[];
  sessions: Session[];
  players: PlayerNote[];
  settings?: Partial<Settings>;
}

export function buildBackup(d: { hands: Hand[]; sessions: Session[]; players: PlayerNote[]; settings: Settings }, now = Date.now()): BackupData {
  return { app: 'sweatbook', v: 1, exportedAt: now, hands: d.hands, sessions: d.sessions, players: d.players, settings: d.settings };
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
  return {
    app: 'sweatbook',
    v: 1,
    exportedAt: typeof j.exportedAt === 'number' ? j.exportedAt : 0,
    hands,
    sessions,
    players,
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

/** Sessions as CSV, for spreadsheets and accountants. */
export function sessionsCsv(list: Session[]): string {
  const head = ['date', 'type', 'game', 'venue', 'currency', 'hours', 'buy_in', 'entries', 'add_on', 'total_cost', 'cash_out', 'sold_pct', 'markup', 'expenses', 'profit', 'place', 'field', 'notes'];
  const rows = list
    .filter((s) => s.endedAt)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) =>
      [
        new Date(s.startedAt).toISOString().slice(0, 10),
        s.kind,
        s.name,
        s.venue,
        s.currency,
        (playedMs(s) / 3600000).toFixed(2),
        s.buyIn,
        s.entries,
        s.addOn || 0,
        cost(s),
        s.cashOut || 0,
        s.staking?.sold ?? 0,
        s.staking?.markup ?? '',
        s.expenses ?? 0,
        Math.round(profit(s) * 100) / 100,
        s.finish,
        s.field,
        s.notes,
      ]
        .map(cell)
        .join(','),
    );
  return [head.join(','), ...rows].join('\n') + '\n';
}

/** "Novos: 3 mãos · 1 sessão · 0 jogadores. …" with the right plurals. */
export function importSummary(n: { hands: number; sessions: number; players: number }): string {
  const parts = [
    n.hands === 1 ? t('1 mão') : t('{n} mãos', { n: n.hands }),
    n.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: n.sessions }),
    n.players === 1 ? t('1 jogador') : t('{n} jogadores', { n: n.players }),
  ];
  return t('Novos: {list}. O que já tinhas ficou.', { list: parts.join(' · ') });
}
