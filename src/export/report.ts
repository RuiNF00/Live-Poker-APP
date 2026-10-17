// The yearly (or any date range) summary a player hands to an accountant or a
// backer, and the hands as CSV. Numbers come from session-math and the
// engine, so the report never disagrees with the Bankroll tab. Pure, so it
// can be tested.

import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { positions, replay } from '@/poker/engine';
import type { Hand } from '@/poker/types';
import { bankrollOf, formatOf, inRange, type DateRange, type Scope, scopeIds } from '@/store/bankroll-math';
import { breakdown, byCurrency, cost, owedToBackers, playedMs, profit, totals, type Breakdown, type Totals } from '@/store/session-math';
import type { Bankroll, Session, Transfer } from '@/store/types';

export interface ReportInput {
  sessions: Session[];
  transfers: Transfer[];
  bankrolls: Bankroll[];
  /** Missing: every bankroll. */
  scope?: Scope;
  range: DateRange;
}

export interface CurrencyReport {
  currency: string;
  totals: Totals;
  deposits: number;
  withdrawals: number;
  cash: { sessions: number; profit: number; hours: number };
  mtt: { sessions: number; profit: number; buyIns: number; cashes: number };
  /** Paid to backers out of prizes. */
  owedToBackers: number;
  byBankroll: Breakdown[];
  byGame: Breakdown[];
  byVenue: Breakdown[];
  byFormat: Breakdown[];
  byMonth: Breakdown[];
  sessions: Session[];
}

export interface Report {
  range: DateRange;
  /** First and last session actually in the report. */
  first?: number;
  last?: number;
  scopeName: string;
  currencies: CurrencyReport[];
}

function group(list: Session[], key: (s: Session) => string): Breakdown[] {
  const m = new Map<string, Breakdown>();
  for (const s of list) {
    const k = key(s);
    if (!k) continue;
    const b = m.get(k) ?? { key: k, sessions: 0, profit: 0, hours: 0, hourly: 0 };
    b.sessions++;
    b.profit += profit(s);
    b.hours += playedMs(s) / 3600000;
    m.set(k, b);
  }
  return [...m.values()].map((b) => ({ ...b, hourly: b.hours > 0 ? b.profit / b.hours : 0 }));
}

const byProfit = (a: Breakdown, b: Breakdown) => b.profit - a.profit;

export function buildReport(inp: ReportInput): Report {
  const ids = inp.scope ? scopeIds(inp.scope, inp.bankrolls) : new Set(inp.bankrolls.map((b) => b.id));
  const inScope = (s: Pick<Session, 'bankrollId' | 'currency'>) => {
    const b = bankrollOf(s, inp.bankrolls);
    return !inp.bankrolls.length || (!!b && ids.has(b.id));
  };
  const list = inp.sessions.filter((s) => s.endedAt && inScope(s) && inRange(s.startedAt, inp.range)).sort((a, b) => a.startedAt - b.startedAt);
  const tx = inp.transfers.filter((x) => ids.has(x.bankrollId) && inRange(x.at, inp.range));
  const currencyOfTx = (x: Transfer) => inp.bankrolls.find((b) => b.id === x.bankrollId)?.currency ?? '';
  const curs = new Set([...list.map((s) => s.currency), ...tx.map(currencyOfTx)]);
  const groups = byCurrency(list).map((g) => g.currency);
  for (const c of curs) if (!groups.includes(c)) groups.push(c);

  const currencies = groups.map((currency): CurrencyReport => {
    const ss = list.filter((s) => s.currency === currency);
    const xs = tx.filter((x) => currencyOfTx(x) === currency);
    const cash = ss.filter((s) => s.kind === 'cash');
    const mtt = ss.filter((s) => s.kind === 'mtt');
    const name = (s: Session) => bankrollOf(s, inp.bankrolls)?.name ?? '';
    return {
      currency,
      totals: totals(ss, currency),
      deposits: xs.filter((x) => x.kind === 'deposit').reduce((a, x) => a + Math.abs(x.amount), 0),
      withdrawals: xs.filter((x) => x.kind === 'withdrawal').reduce((a, x) => a + Math.abs(x.amount), 0),
      cash: { sessions: cash.length, profit: cash.reduce((a, s) => a + profit(s), 0), hours: cash.reduce((a, s) => a + playedMs(s), 0) / 3600000 },
      mtt: { sessions: mtt.length, profit: mtt.reduce((a, s) => a + profit(s), 0), buyIns: mtt.reduce((a, s) => a + cost(s), 0), cashes: mtt.filter((s) => s.cashOut > 0).length },
      owedToBackers: ss.reduce((a, s) => a + owedToBackers(s), 0),
      byBankroll: group(ss, name).sort(byProfit),
      byGame: breakdown(ss, 'name', currency),
      byVenue: breakdown(ss, 'venue', currency),
      byFormat: group(ss, (s) => (formatOf(s) === 'online' ? 'Online' : 'Live')).sort(byProfit),
      byMonth: group(ss, (s) => {
        const d = new Date(s.startedAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }).sort((a, b) => a.key.localeCompare(b.key)),
      sessions: ss,
    };
  });

  const scopeName = !inp.scope
    ? t('Todas as bankrolls')
    : 'bankrollId' in inp.scope
      ? (inp.bankrolls.find((b) => 'bankrollId' in inp.scope! && b.id === inp.scope.bankrollId)?.name ?? '')
      : t('Todas {currency}', { currency: inp.scope.currency });
  return { range: inp.range, first: list[0]?.startedAt, last: list[list.length - 1]?.startedAt, scopeName, currencies };
}

// ─── Hands CSV ───────────────────────────────────────────────────────────────

function cell(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One row per hand: when, where, hero's spot and cards, the board and what hero won or lost. */
export function handsCsv(hands: Hand[], sessions: Session[], range: DateRange = {}, shareBase?: string): string {
  const head = ['date', 'time', 'type', 'game', 'venue', 'session', 'blinds', 'ante', 'players', 'position', 'hero_cards', 'combo', 'board', 'result_chips', 'result_bb', 'tags', 'title', 'notes', 'link'];
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const rows = hands
    .filter((h) => inRange(h.createdAt, range))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((h) => {
      const d = new Date(h.createdAt);
      const pos = positions(h.players.length, h.button)[h.hero] ?? '';
      const cards = h.players[h.hero]?.cards ?? [];
      let net: number | undefined;
      try {
        net = replay(h).result?.net[h.hero];
      } catch {
        net = undefined;
      }
      const s = h.sessionId ? byId.get(h.sessionId) : undefined;
      return [
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        h.game.kind,
        h.game.name,
        h.game.venue ?? s?.venue ?? '',
        s?.name ?? '',
        `${h.game.sb}/${h.game.bb}`,
        h.game.ante || '',
        h.players.length,
        pos,
        cards.join(' '),
        cards.length === 2 ? comboLabel(cards) : '',
        h.board.join(' '),
        net === undefined ? '' : round2(net),
        net === undefined || !h.game.bb ? '' : round2(net / h.game.bb),
        h.tags.join(' | '),
        h.title ?? '',
        h.notes,
        h.shareId && shareBase ? `${shareBase}/h/${h.shareId}` : '',
      ]
        .map(cell)
        .join(',');
    });
  return [head.join(','), ...rows].join('\n') + '\n';
}
