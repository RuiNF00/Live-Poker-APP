// Rows of an exported CSV → Sweatbook sessions. The result the other app
// shows (net profit) is what the player knows, so when the file has one the
// session is built to land on exactly that number. Pure, so it can be tested.

import { t } from '@/i18n';
import type { Session } from '@/store/types';

import { readTable, type Table } from './csv';
import { NO_VALUE, parseNum } from './num';
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

/** A deposit or withdrawal read from the file; the import screen picks its bankroll. */
export interface ImportedMove {
  id: string;
  kind: 'deposit' | 'withdrawal';
  /** Always positive. */
  amount: number;
  at: number;
  currency: string;
  note: string;
}

/** Why a row of the file was left out. */
export type FailReason = 'noDate' | 'badDate' | 'noMoney' | 'badMoney' | 'badMove';

export interface FailedRow {
  /** Line in the file (1 = first line). */
  line: number;
  reason: FailReason;
  /** The cell that couldn't be read, or the start of the row. */
  value: string;
}

export interface ImportResult {
  sessions: Session[];
  /** Deposits and withdrawals: bankroll moves, not poker. */
  moves: ImportedMove[];
  /** Bankroll rows that couldn't be read as a deposit or withdrawal (no date or amount). */
  transfers: number;
  /** Rows without a date or any money in them. */
  unreadable: number;
  /** Every row left out (transfers and unreadable ones), in file order, with why. */
  failed: FailedRow[];
  order: DateOrder;
  /** The file says which sessions are cash and which are tournaments. */
  kindKnown: boolean;
  /** Some dates read differently day-first and month-first. */
  ambiguousDates: boolean;
  /** Bankroll name per session or move id, from Sweatbook's own CSV: goes back to the bankroll of that name. */
  bankrollNames: Record<string, string>;
}

/** Everything the import screen needs after a file is picked. */
export interface Prepared {
  /** The file as picked, kept so the player can choose to send it to us when something doesn't read. */
  text: string;
  table: Table;
  source: SourceId;
  mapping: Mapping;
}

export function prepare(text: string): Prepared {
  const table = readTable(text, knownHeader);
  const source = detectSource(text, table);
  return { text, table, source, mapping: byValues(table, mappingFor(source, table.headers)) };
}

/** "Lugar" is the finishing place in Portuguese and the venue in Spanish: the column's values decide. */
function byValues(table: Table, m: Mapping): Mapping {
  const col = m.finish;
  if (col === undefined || m.venue !== undefined) return m;
  const vals = table.rows.map((r) => (r[col] ?? '').trim()).filter(Boolean);
  if (!vals.length || vals.filter((v) => /^\d+(º|ª|st|nd|rd|th|°)?$/i.test(v)).length * 2 > vals.length) return m;
  const { finish, ...rest } = m;
  return { ...rest, venue: finish };
}

const CURRENCY: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', BRL: 'R$', CHF: 'CHF', HKD: 'HK$', AUD: 'A$', '€': '€', $: '$', '£': '£', R$: 'R$', US$: '$' };

export function currencyOf(raw: string, fallback: string): string {
  const c = raw.trim();
  if (!c) return fallback;
  return CURRENCY[c.toUpperCase()] ?? CURRENCY[c] ?? c.slice(0, 4);
}

export { parseNum };

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

// English, Portuguese, Spanish and French short names (accents dropped first).
const MONTHS: Record<string, number> = { jan: 1, ene: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, avr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, ago: 8, aou: 8, sep: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12, dic: 12 };
const month = (w: string) => MONTHS[w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()];

function timeOf(rest: string): { h: number; mi: number; sec: number; hasTime: boolean } {
  // "20:00", "8:00 PM", and "20h00" as written in Portugal, Spain and France.
  const m = rest.match(/(\d{1,2})[:h](\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);
  if (!m) return { h: 0, mi: 0, sec: 0, hasTime: false };
  let h = Number(m[1]);
  const pm = m[4]?.toLowerCase().startsWith('p');
  if (m[4] && h === 12) h = 0;
  if (pm) h += 12;
  return { h, mi: Number(m[2]), sec: Number(m[3] ?? 0), hasTime: true };
}

// The same cell is split up to four times (order guess, start, ambiguity check),
// so remember the answers; pure, so sharing them between files is safe.
const splits = new Map<string, DateParts | null>();

function splitDate(raw: string): DateParts | null {
  let p = splits.get(raw);
  if (p !== undefined) return p;
  if (splits.size > 50_000) splits.clear();
  p = splitDateOnce(raw);
  splits.set(raw, p);
  return p;
}

function splitDateOnce(raw: string): DateParts | null {
  // A weekday in front ("Sat, Oct 17 2026", "sáb. 17 out 2026") says nothing the date doesn't.
  const t = raw.trim();
  const s = /^\d/.test(t) ? t : t.replace(/^([^\d\s,.]{2,9})\.?,?\s+(?=\d|[^\d\s]{3,}\.?\s+\d)/u, (w, word: string) => (month(word.slice(0, 3)) ? w : ''));
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/);
  if (m) return { y: +m[1], a: +m[2], b: +m[3], ymd: true, ...timeOf(m[4]) };
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(.*)$/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return { a: +m[1], b: +m[2], y, ymd: false, ...timeOf(m[4]) };
  }
  // "20 Sep 2024", "Sep 20, 2024", "20-set-2024"
  m = s.match(/^(\d{1,2})[\s-]+(?:de\s+)?([^\d\s-]{3})[^\d\s-]*\.?[\s-]+(?:de\s+)?(\d{4})(.*)$/iu) ?? null;
  if (m && month(m[2])) return { y: +m[3], a: month(m[2]), b: +m[1], ymd: true, ...timeOf(m[4]) };
  m = s.match(/^([^\d\s]{3})[^\d\s]*\.?\s+(\d{1,2}),?\s+(\d{4})(.*)$/iu);
  if (m && month(m[1])) return { y: +m[3], a: month(m[1]), b: +m[2], ymd: true, ...timeOf(m[4]) };
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
  // "1d 2h", "1 day 2 hours": a long tournament day written out.
  let m = s.match(/^(\d+)\s*d[a-z]*\s*(?:(\d+)\s*h[a-z]*)?\s*(?:(\d+)\s*m[a-z]*)?$/);
  if (m) return Number(m[1]) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
  m = s.match(/^(\d+)\s*[:h]\s*(\d{1,2})(?::(\d{2}))?\s*m?i?n?$/);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  m = s.match(/^(\d+)\s*min/);
  if (m) return Number(m[1]) / 60;
  const n = parseNum(s.replace(/h(ours?|oras?)?$/, ''));
  return n !== null && n >= 0 ? n : null;
}

// ─── Values ──────────────────────────────────────────────────────────────────

const TRANSFER = /deposit|withdraw|payout|cash ?in\b|transfer|transac|bonus|rakeback|dep[oó]sito|levantamento|retirada|transfer[eê]ncia|bankroll/i;
const MTT = /tourn|torn|torne|mtt|sng|sit ?[&n]|sit\s*(and|e|y)\s*go|spin|freeze|freeroll|bounty|\bko\b|satell?it|sat[eé]lit|turnier|tournoi/i;
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

const ONLINE = /online|internet|pokerstars|ggpoker|gg ?network|partypoker|888poker|winamax|ipoker|americas ?cardroom|\bacr\b|wpt ?global|natural ?8|ignition|bovada|coinpoker|unibet|betfair/i;
const LIVE = /live|casino|club|clube|home|casa|cardroom|room|sala|bar|private/i;

/** "Online", "Casino", "Club", "Live" → where it was played; null when the cell doesn't say. */
export function formatOf(raw: string): 'live' | 'online' | null {
  if (!raw.trim()) return null;
  if (ONLINE.test(raw)) return 'online';
  if (LIVE.test(raw)) return 'live';
  return null;
}

const WITHDRAW = /withdraw|payout|cash ?out|levant|retirad|saque|retrait|auszahl/i;

/** A bankroll row as a deposit or withdrawal: the sign of the amount, or the words on the row. */
function moveOf(r: string[], get: (r: string[], f: Field) => string, at: number, opt: ImportOptions): ImportedMove | null {
  const net = parseNum(get(r, 'profit'));
  const out = parseNum(get(r, 'cashOut'));
  const inn = parseNum(get(r, 'buyIn'));
  const v = net ?? (out !== null || inn !== null ? (out ?? 0) - (inn ?? 0) : null);
  if (v === null || Math.abs(v) < 0.005) return null;
  const words = [get(r, 'kind'), get(r, 'game'), get(r, 'name'), get(r, 'notes')].join(' ');
  // "Deposit/Payout" (PBT) says both; then the sign decides.
  const both = TRANSFER_IN.test(words) && WITHDRAW.test(words);
  const kind: 'deposit' | 'withdrawal' = !both && WITHDRAW.test(words) ? 'withdrawal' : !both && TRANSFER_IN.test(words) ? (v < 0 ? 'withdrawal' : 'deposit') : v < 0 ? 'withdrawal' : 'deposit';
  const currency = currencyOf(get(r, 'currency'), opt.currency);
  const amount = round2(Math.abs(v));
  const note = get(r, 'notes');
  return { id: 'imx_' + hash([opt.source, at, kind, amount, currency].join('|')), kind, amount, at, currency, note };
}

const TRANSFER_IN = /deposit|dep[oó]sito|cash ?in\b|top ?up|carregamento|einzahl|d[eé]p[oô]t/i;

// ─── Rows → sessions ─────────────────────────────────────────────────────────

/** Sessions from a mapped table. Same file twice gives the same ids, so a re-import adds nothing. */
export function toSessions(table: Table, mapping: Mapping, opt: ImportOptions): ImportResult {
  const run = convert(table, mapping, opt);
  for (;;) {
    const step = run.next();
    if (step.done) return step.value;
  }
}

/** Rows converted between two looks at the clock. */
const CHUNK = 100;
/** Longest the screen goes without drawing while a file is converted. */
const SLICE_MS = 50;

/**
 * toSessions in steps, so a file with years of sessions doesn't freeze the
 * screen: hands control back every SLICE_MS and says how far it got.
 * Null when `cancelled` turns true (the player left or changed a column); nothing is kept.
 */
export async function toSessionsAsync(
  table: Table,
  mapping: Mapping,
  opt: ImportOptions,
  progress?: { onProgress?: (done: number, total: number) => void; cancelled?: () => boolean; sliceMs?: number },
): Promise<ImportResult | null> {
  const run = convert(table, mapping, opt);
  let since = Date.now();
  for (;;) {
    const step = run.next();
    if (step.done) return step.value;
    // Each pause costs a redraw, so pause only once the screen has waited long enough to notice.
    if (Date.now() - since < (progress?.sliceMs ?? SLICE_MS)) continue;
    progress?.onProgress?.(step.value, table.rows.length);
    await new Promise((r) => setTimeout(r, 0));
    if (progress?.cancelled?.()) return null;
    since = Date.now();
  }
}

/** Yields how many rows are done every CHUNK rows; returns the result. */
function* convert(table: Table, mapping: Mapping, opt: ImportOptions): Generator<number, ImportResult> {
  const get = (r: string[], f: Field) => (mapping[f] === undefined ? '' : (r[mapping[f]!] ?? '').trim());
  const order = opt.order ?? guessOrder(table.rows.flatMap((r) => [get(r, 'start'), get(r, 'end')]));
  // A "type" column that holds Casino/Club, not cash or tournament, says nothing about the kind.
  const kindUseful = mapping.kind !== undefined && table.rows.some((r) => kindOf(get(r, 'kind')) !== null);
  const sessions: Session[] = [];
  const seen = new Map<string, number>();
  let transfers = 0;
  const moves: ImportedMove[] = [];
  let unreadable = 0;
  const failed: FailedRow[] = [];
  const preview = (r: string[]) => r.filter(Boolean).join(' · ').slice(0, 60);
  const bankrollNames: Record<string, string> = {};

  for (let ri = 0; ri < table.rows.length; ri++) {
    if (ri && ri % CHUNK === 0) yield ri;
    const r = table.rows[ri];
    const line = table.lines?.[ri] ?? ri + 2;
    // Trip expenses in Sweatbook's CSV belong to a trip, not to the sessions.
    if (opt.source === 'sweatbook' && /^expense$/i.test(get(r, 'kind'))) continue;
    // Sweatbook's own id: importing the same file again merges instead of doubling.
    const own = opt.source === 'sweatbook' && /^[\w.-]{1,80}$/.test(get(r, 'id')) ? get(r, 'id') : '';
    const k = kindUseful ? kindOf(get(r, 'kind')) : null;
    const nameRaw = get(r, 'name');
    const isMove = k === 'transfer' || (!k && TRANSFER.test(get(r, 'game') + ' ' + nameRaw));
    const startP = parseDate(get(r, 'start'), order);
    if (isMove) {
      const m = startP && moveOf(r, get, startP.t, opt);
      if (m) {
        const dup = seen.get(m.id) ?? 0;
        seen.set(m.id, dup + 1);
        if (own) m.id = own;
        if (get(r, 'bankroll')) bankrollNames[m.id] = get(r, 'bankroll');
        moves.push(dup && !own ? { ...m, id: m.id + '_' + dup } : m);
      } else {
        transfers++;
        failed.push({ line, reason: startP ? 'badMove' : get(r, 'start') ? 'badDate' : 'noDate', value: startP ? preview(r) : get(r, 'start') || preview(r) });
      }
      continue;
    }
    if (!startP) {
      unreadable++;
      failed.push({ line, reason: get(r, 'start') ? 'badDate' : 'noDate', value: get(r, 'start') || preview(r) });
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
    const tips = Math.abs(parseNum(get(r, 'tips')) ?? 0);
    const handsDealt = parseNum(get(r, 'handsDealt'));
    // "cem" or "?" where an amount goes: reading it as 0 would change the result without a word.
    const bad = (['profit', 'buyIn', 'cashOut'] as const).map((f) => get(r, f)).find((v) => v && /\p{L}|\?/u.test(v) && !NO_VALUE.test(v.trim()) && parseNum(v) === null);
    if (bad) {
      unreadable++;
      failed.push({ line, reason: 'badMoney', value: bad });
      continue;
    }
    if (buyIn === null && cashOut === null && net === null) {
      unreadable++;
      failed.push({ line, reason: 'noMoney', value: [get(r, 'profit'), get(r, 'buyIn'), get(r, 'cashOut')].filter(Boolean).join(' · ') || preview(r) });
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
        const g = net + expenses + tips;
        if (g >= 0) out = g;
        else cost = -g;
      } else {
        const diff = round2(net - (out - cost - Math.abs(addOn) - expenses - tips));
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
    // Minutes played, or hours: next to an end time, the difference is the breaks.
    const hrs = mapping.minutes === undefined && endP ? parseHours(get(r, 'hours')) : null;
    const played = parseNum(get(r, 'minutes')) ?? (hrs === null ? null : hrs * 60);
    const brk = endP && played !== null ? (end - start) / 60000 - played : parseNum(get(r, 'breakMinutes'));
    if (brk && brk > 0.5 && brk * 60000 < end - start) breaks.push({ start: end - brk * 60000, end });

    let sb = parseNum(get(r, 'sb')) ?? 0;
    let bb = parseNum(get(r, 'bb')) ?? 0;
    // Blinds can sit in the stakes column, or only in the game or name ("NLH 1/2").
    const stakes = [get(r, 'stakes'), ...(kind === 'cash' ? [get(r, 'game'), nameRaw] : [])].map((v) => v.match(/([\d.,]+)\s*\/\s*([\d.,]+)/)).find(Boolean);
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
    const format = formatOf(get(r, 'format')) ?? (ONLINE.test(venue) ? 'online' : null);
    const base = [opt.source, start, venue, name, round2(net ?? out - cost)].join('|');
    // Two identical rows (same start, place and result) are still two sessions.
    const dup = seen.get(base) ?? 0;
    seen.set(base, dup + 1);

    const id = own || 'imp_' + hash(base + (dup ? '#' + dup : ''));
    if (get(r, 'bankroll')) bankrollNames[id] = get(r, 'bankroll');
    const country = get(r, 'country').toUpperCase();
    const day = parseNum(get(r, 'day'));
    sessions.push({
      id,
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
      ...(tips ? { tips: round2(tips) } : null),
      ...(handsDealt && handsDealt > 0 ? { handsDealt: Math.round(handsDealt) } : null),
      sb,
      bb,
      ante: 0,
      anteType: 'none',
      tableSize: tableSizeOf(get(r, 'tableSize'), opt.tableSize),
      stack: 0,
      stackLog: [],
      roster: [],
      notes,
      ...(format ? { format } : null),
      ...(/^[A-Z]{2}$/.test(country) ? { country } : null),
      ...(kind === 'mtt' && day && day > 1 ? { day: Math.round(day) } : null),
      // No updatedAt: importing the same file again never overwrites a session edited since.
    });
  }
  return { sessions, moves, transfers, unreadable, failed, order, kindKnown: kindUseful, bankrollNames, ambiguousDates: table.rows.some((r) => isAmbiguous(get(r, 'start'))) };
}

/** 03/04/2025 could be either; 2025-04-03 and 25/04/2025 can't. */
function isAmbiguous(v: string): boolean {
  const p = splitDate(v);
  return !!p && !p.ymd && p.a <= 12 && p.b <= 12 && p.a !== p.b;
}

/** Fields the import screen lets the player point at a column, in display order. */
export const EDITABLE: Field[] = FIELDS.filter((f) => f !== 'tags' && f !== 'handsDealt' && f !== 'limit' && f !== 'breakMinutes' && f !== 'rebuyCost' && f !== 'addOn' && f !== 'tableSize' && f !== 'sb' && f !== 'bb' && f !== 'id' && f !== 'bankroll' && f !== 'country' && f !== 'day');
