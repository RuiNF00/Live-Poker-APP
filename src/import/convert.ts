// Rows of an exported CSV → Sweatbook sessions. The result the other app
// shows (net profit) is what the player knows, so when the file has one the
// session is built to land on exactly that number. Pure, so it can be tested.

import { t } from '@/i18n';
import type { Session } from '@/store/types';

import { readTable, type Table } from './csv';
import { detectSource, FIELDS, knownHeader, mappingFor, type Field, type Mapping, type SourceId } from './mapping';

export type DateOrder = 'dmy' | 'mdy';

export interface ImportOptions {
  currency: string;
  tableSize: number;
  source: SourceId;
  /** Day/month order for dates like 03/04/2024; worked out from the file when left out. */
  order?: DateOrder;
  /** For files that don't say cash or tournament (Pokerbase). */
  defaultKind?: 'mtt' | 'cash';
}

export interface ImportResult {
  sessions: Session[];
  /** Deposits, withdrawals and transfers: bankroll moves, not poker. */
  transfers: number;
  /** Rows without a date or any money in them. */
  unreadable: number;
  order: DateOrder;
  /** The file says which sessions are cash and which are tournaments. */
  kindKnown: boolean;
  /** Some dates read differently day-first and month-first. */
  ambiguousDates: boolean;
}

/** Everything the import screen needs after a file is picked. */
export interface Prepared {
  table: Table;
  source: SourceId;
  mapping: Mapping;
}

export function prepare(text: string): Prepared {
  const table = readTable(text, knownHeader);
  const source = detectSource(text, table);
  return { table, source, mapping: mappingFor(source, table.headers) };
}

const CURRENCY: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', BRL: 'R$', CHF: 'CHF', '€': '€', $: '$', '£': '£', R$: 'R$', US$: '$' };

export function currencyOf(raw: string, fallback: string): string {
  const c = raw.trim();
  if (!c) return fallback;
  return CURRENCY[c.toUpperCase()] ?? CURRENCY[c] ?? c.slice(0, 4);
}

/**
 * "1.234,56", "1,234.56", "-€120", "(45)", "0,5" → numbers. Comma alone is a
 * decimal mark unless it groups thousands ("1,500").
 */
export function parseNum(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.trim().replace(/[−‒–]/g, '-');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[^\d.,\-+eE]/g, '');
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

interface DateParts {
  a: number;
  b: number;
  y: number;
  ymd: boolean;
  h: number;
  mi: number;
  sec: number;
  hasTime: boolean;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12 };

function timeOf(rest: string): { h: number; mi: number; sec: number; hasTime: boolean } {
  const m = rest.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);
  if (!m) return { h: 0, mi: 0, sec: 0, hasTime: false };
  let h = Number(m[1]);
  const pm = m[4]?.toLowerCase().startsWith('p');
  if (m[4] && h === 12) h = 0;
  if (pm) h += 12;
  return { h, mi: Number(m[2]), sec: Number(m[3] ?? 0), hasTime: true };
}

function splitDate(raw: string): DateParts | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/);
  if (m) return { y: +m[1], a: +m[2], b: +m[3], ymd: true, ...timeOf(m[4]) };
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(.*)$/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return { a: +m[1], b: +m[2], y, ymd: false, ...timeOf(m[4]) };
  }
  // "20 Sep 2024", "Sep 20, 2024", "20-set-2024"
  m = s.match(/^(\d{1,2})[\s-]+([a-z]{3})[a-z.]*[\s-]+(\d{4})(.*)$/i) ?? null;
  if (m && MONTHS[m[2].toLowerCase()]) return { y: +m[3], a: MONTHS[m[2].toLowerCase()], b: +m[1], ymd: true, ...timeOf(m[4]) };
  m = s.match(/^([a-z]{3})[a-z.]*\s+(\d{1,2}),?\s+(\d{4})(.*)$/i);
  if (m && MONTHS[m[1].toLowerCase()]) return { y: +m[3], a: MONTHS[m[1].toLowerCase()], b: +m[2], ymd: true, ...timeOf(m[4]) };
  return null;
}

/** dd/mm or mm/dd: a first number over 12 means day first, a second one over 12 means month first. */
export function guessOrder(values: string[], fallback: DateOrder = 'dmy'): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    const p = splitDate(v);
    if (!p || p.ymd) continue;
    if (p.a > 12) dmy++;
    else if (p.b > 12) mdy++;
  }
  if (dmy === mdy) return fallback;
  return dmy > mdy ? 'dmy' : 'mdy';
}

/** Local time in ms, or null. Unix seconds and milliseconds also work. */
export function parseDate(raw: string | undefined, order: DateOrder): { t: number; hasTime: boolean } | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{10}$/.test(s)) return { t: Number(s) * 1000, hasTime: true };
  if (/^\d{13}$/.test(s)) return { t: Number(s), hasTime: true };
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? { t, hasTime: true } : null;
  }
  const p = splitDate(s);
  if (!p) return null;
  const [mo, d] = p.ymd ? [p.a, p.b] : order === 'dmy' ? [p.b, p.a] : [p.a, p.b];
  const date = new Date(p.y, mo - 1, d, p.h, p.mi, p.sec);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d || p.y < 1990 || p.y > 2100) return null;
  return { t: date.getTime(), hasTime: p.hasTime };
}

/** "3:30", "3h30", "3.5", "210 min" → hours. */
export function parseHours(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  let m = s.match(/^(\d+)\s*[:h]\s*(\d{1,2})(?::(\d{2}))?\s*m?i?n?$/);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  m = s.match(/^(\d+)\s*min/);
  if (m) return Number(m[1]) / 60;
  const n = parseNum(s.replace(/h(ours?|oras?)?$/, ''));
  return n !== null && n >= 0 ? n : null;
}

// ─── Values ──────────────────────────────────────────────────────────────────

const TRANSFER = /deposit|withdraw|payout|cash ?in\b|transfer|transac|bonus|rakeback|dep[oó]sito|levantamento|retirada|transfer[eê]ncia|bankroll/i;
const MTT = /tourn|torn|torne|mtt|sng|sit ?[&n]|spin|freeze|bounty|\bko\b|satell?it|sat[eé]lit|turnier|tournoi/i;
const CASH = /cash|ring|dinheiro|efectivo|cashgame/i;

export function kindOf(raw: string): 'mtt' | 'cash' | 'transfer' | null {
  if (!raw.trim()) return null;
  if (TRANSFER.test(raw)) return 'transfer';
  if (MTT.test(raw)) return 'mtt';
  if (CASH.test(raw)) return 'cash';
  return null;
}

/** "Holdem" + "No Limit" → "NLH"; anything else stays as written. */
export function gameLabel(game: string, limit: string): string {
  const g = game.trim();
  const l = limit.trim().toLowerCase();
  const pre = /^no ?limit|^nl$/.test(l) ? 'NL' : /^pot ?limit|^pl$/.test(l) ? 'PL' : /^fixed|^limit$|^fl$/.test(l) ? 'FL' : '';
  if (/hold.?em/i.test(g)) return pre ? pre + 'H' : g;
  if (/^omaha$|^plo$/i.test(g)) return pre === 'PL' || !pre ? 'PLO' : pre + 'O';
  if (/omaha.*(hi.?lo|8)/i.test(g)) return (pre || 'PL') + 'O8';
  return [pre && !/^(nl|pl|fl)/i.test(g) ? limit.trim() : '', g].filter(Boolean).join(' ');
}

function trimNum(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** "Full-Ring" 9, "6-Max" 6, "Heads-Up" 2, or a number. */
function tableSizeOf(raw: string, fallback: number): number {
  const s = raw.toLowerCase();
  if (/full|ring|cheia/.test(s)) return 9;
  if (/heads|hu\b/.test(s)) return 2;
  const n = parseInt(s, 10);
  return n >= 2 && n <= 10 ? n : fallback;
}

function hash(s: string): string {
  // FNV-1a, twice with different seeds: short, stable, no crypto needed.
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Rows → sessions ─────────────────────────────────────────────────────────

/** Sessions from a mapped table. Same file twice gives the same ids, so a re-import adds nothing. */
export function toSessions(table: Table, mapping: Mapping, opt: ImportOptions): ImportResult {
  const get = (r: string[], f: Field) => (mapping[f] === undefined ? '' : (r[mapping[f]!] ?? '').trim());
  const order = opt.order ?? guessOrder(table.rows.flatMap((r) => [get(r, 'start'), get(r, 'end')]));
  // A "type" column that holds Casino/Club, not cash or tournament, says nothing about the kind.
  const kindUseful = mapping.kind !== undefined && table.rows.some((r) => kindOf(get(r, 'kind')) !== null);
  const sessions: Session[] = [];
  const seen = new Map<string, number>();
  let transfers = 0;
  let unreadable = 0;

  for (const r of table.rows) {
    const k = kindUseful ? kindOf(get(r, 'kind')) : null;
    const nameRaw = get(r, 'name');
    if (k === 'transfer' || (!k && TRANSFER.test(get(r, 'game') + ' ' + nameRaw))) {
      transfers++;
      continue;
    }
    const startP = parseDate(get(r, 'start'), order);
    if (!startP) {
      unreadable++;
      continue;
    }
    let start = startP.t;
    if (!startP.hasTime) {
      const tm = get(r, 'time').match(/(\d{1,2}):(\d{2})/);
      const d = new Date(start);
      if (tm) d.setHours(Number(tm[1]), Number(tm[2]), 0, 0);
      else d.setHours(18, 0, 0, 0);
      start = d.getTime();
    }

    const buyIn = parseNum(get(r, 'buyIn'));
    const rebuy = parseNum(get(r, 'rebuyCost')) ?? 0;
    const addOn = parseNum(get(r, 'addOn')) ?? 0;
    const cashOut = parseNum(get(r, 'cashOut'));
    const net = parseNum(get(r, 'profit'));
    const srcExp = Math.abs(parseNum(get(r, 'expenses')) ?? 0);
    if (buyIn === null && cashOut === null && net === null) {
      unreadable++;
      continue;
    }

    const finish = parseNum(get(r, 'finish'));
    const field = parseNum(get(r, 'field'));
    // No usable kind column: a finishing place, or a name with no game next to it, means a tournament.
    const kind: 'mtt' | 'cash' = k === 'mtt' || k === 'cash' ? k : (finish ?? 0) > 0 || (nameRaw && mapping.game === undefined) ? 'mtt' : (opt.defaultKind ?? 'cash');

    // Money: what went in, what came out, and the net the other app showed.
    let cost = Math.abs(buyIn ?? 0) + Math.abs(rebuy);
    let out = cashOut ?? 0;
    let expenses = srcExp;
    const extra: string[] = [];
    if (net !== null) {
      if (buyIn === null && cashOut === null) {
        // Only the result is known (Pokerbase): put it all on one side.
        const g = net + expenses;
        if (g >= 0) out = g;
        else cost = -g;
      } else {
        const diff = round2(net - (out - cost - Math.abs(addOn) - expenses));
        if (diff < 0) expenses = round2(expenses - diff);
        else if (diff > 0 && (kind === 'cash' || out > 0)) out = round2(out + diff);
        else if (diff > 0) expenses = round2(expenses - diff);
        if (Math.abs(diff) >= 0.01) extra.push(t('Ajuste da importação: {amount} (bounties, staking ou outros)', { amount: (diff > 0 ? '+' : '') + trimNum(diff) }));
      }
    }

    // Time at the table.
    const endP = parseDate(get(r, 'end'), order);
    let end: number;
    if (endP) {
      end = endP.hasTime ? endP.t : start;
      if (!endP.hasTime && end <= start) {
        const tm = get(r, 'end').match(/(\d{1,2}):(\d{2})/);
        if (tm) end = new Date(start).setHours(Number(tm[1]), Number(tm[2]), 0, 0);
      }
    } else {
      const h = parseHours(get(r, 'hours')) ?? ((parseNum(get(r, 'minutes')) ?? 0) / 60 || null);
      end = start + (h ?? 0) * 3600000;
    }
    // A clock time earlier than the start is past midnight.
    if (end < start && start - end < 86400000) end += 86400000;
    if (end < start) end = start;
    const breaks: Session['breaks'] = [];
    const played = parseNum(get(r, 'minutes'));
    const brk = endP && played !== null ? (end - start) / 60000 - played : parseNum(get(r, 'breakMinutes'));
    if (brk && brk > 0.5 && brk * 60000 < end - start) breaks.push({ start: end - brk * 60000, end });

    let sb = parseNum(get(r, 'sb')) ?? 0;
    let bb = parseNum(get(r, 'bb')) ?? 0;
    const stakes = get(r, 'stakes').match(/([\d.,]+)\s*\/\s*([\d.,]+)/);
    if (stakes && !bb) {
      sb = parseNum(stakes[1]) ?? 0;
      bb = parseNum(stakes[2]) ?? 0;
    }
    const game = gameLabel(get(r, 'game'), get(r, 'limit'));
    const name =
      kind === 'mtt'
        ? nameRaw || game || t('Torneio')
        : [nameRaw || game || 'Cash', bb > 0 && !/\d\/\d/.test(nameRaw) ? `${trimNum(sb || bb / 2)}/${trimNum(bb)}` : ''].filter(Boolean).join(' ');
    const notes = [get(r, 'notes'), get(r, 'tags') ? '#' + get(r, 'tags').replace(/\s*,\s*/g, ' #') : '', ...extra].filter(Boolean).join('\n');

    const venue = get(r, 'venue');
    const base = [opt.source, start, venue, name, round2(net ?? out - cost)].join('|');
    // Two identical rows (same start, place and result) are still two sessions.
    const dup = seen.get(base) ?? 0;
    seen.set(base, dup + 1);

    sessions.push({
      id: 'imp_' + hash(base + (dup ? '#' + dup : '')),
      kind,
      name,
      venue,
      currency: currencyOf(get(r, 'currency'), opt.currency),
      startedAt: start,
      endedAt: end,
      breaks,
      buyIn: round2(cost),
      entries: 1,
      addOn: round2(Math.abs(addOn)),
      cashOut: round2(out),
      finish: kind === 'mtt' && finish && finish > 0 ? Math.round(finish) : undefined,
      field: kind === 'mtt' && field && field > 0 ? Math.round(field) : undefined,
      expenses: expenses ? round2(expenses) : undefined,
      sb,
      bb,
      ante: 0,
      anteType: 'none',
      tableSize: tableSizeOf(get(r, 'tableSize'), opt.tableSize),
      stack: 0,
      stackLog: [],
      roster: [],
      notes,
      // No updatedAt: importing the same file again never overwrites a session edited since.
    });
  }
  return { sessions, transfers, unreadable, order, kindKnown: kindUseful, ambiguousDates: table.rows.some((r) => isAmbiguous(get(r, 'start'))) };
}

/** 03/04/2025 could be either; 2025-04-03 and 25/04/2025 can't. */
function isAmbiguous(v: string): boolean {
  const p = splitDate(v);
  return !!p && !p.ymd && p.a <= 12 && p.b <= 12 && p.a !== p.b;
}

/** Fields the import screen lets the player point at a column, in display order. */
export const EDITABLE: Field[] = FIELDS.filter((f) => f !== 'tags' && f !== 'limit' && f !== 'breakMinutes' && f !== 'rebuyCost' && f !== 'addOn' && f !== 'tableSize' && f !== 'sb' && f !== 'bb');
