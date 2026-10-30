// Past live tournament results, copied from a results page (the player's table on a
// tournament database, a series' results) or typed by hand, → Sweatbook sessions.
// A row has a date, the event, the place ("23rd", "5.º", "1er") and the prize with its
// currency; the buy-in is often in the event's name ("$1,500 No-Limit Hold'em").
//
// Those pages list only the cashes, never the tournaments that paid nothing, so every
// session made here carries `cashList` and stays out of the results until the player
// counts them. Money is never guessed: a row with no buy-in written waits for the player
// to type one. Pure, so it can be tested.

import { t } from '@/i18n';
import type { Session } from '@/store/types';

import { currencyOf, guessOrder, hash, parseDate, type DateOrder } from './convert';
import { detectSeparator, norm, parseCsv } from './csv';
import { parseNum } from './num';

export interface ResultRow {
  /** Line in the pasted text where the result starts (1 = first line). */
  line: number;
  /** The day, at noon (a results page has no hours). */
  at: number;
  name: string;
  venue: string;
  finish?: number;
  field?: number;
  prize: number;
  /** Stored currency value ('$', '€', 'CAD'…); missing when the text didn't say. */
  currency?: string;
  /** One entry, fee included, as written in the event's name or a buy-in column. */
  buyIn?: number;
  /** The result as pasted, for the review. */
  text: string;
}

/** Why a line of the text was left out. */
export type SkipReason = 'noDate' | 'noPrize' | 'repeat';

export interface SkippedLine {
  line: number;
  reason: SkipReason;
  value: string;
}

export interface ParsedResults {
  rows: ResultRow[];
  skipped: SkippedLine[];
  order: DateOrder;
  /** Some dates read differently day-first and month-first (03/04/2024). */
  ambiguousDates: boolean;
}

// ─── Pieces of a row ─────────────────────────────────────────────────────────

// Symbols longest first ("US$" before "$"), then ISO codes.
const CUR = String.raw`(?:US\$|R\$|HK\$|AU\$|A\$|CA\$|C\$|MX\$|NZ\$|S\$|[€$£¥₩₱₹]|\b(?:EUR|USD|GBP|BRL|CHF|HKD|AUD|CAD|MXN|JPY|SGD|PHP|KRW|NZD|SEK|NOK|DKK|PLN|CZK|INR|ZAR|ARS|CLP|COP|PEN|UYU|MOP|VND)\b)`;
// "1,500", "12.400", "1.234,56", "550", "7423.50"; after the amount also "12 400" (a French or Portuguese page).
// "456 C$4,200" is a field and a prize: a currency right before digits is the next amount's.
const AMT = String.raw`\d{1,3}(?:[.,  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const AMT_SP = String.raw`\d{1,3}(?:[.,   ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const MONEY = new RegExp(String.raw`(${CUR})\s?(${AMT})(\s?[kKM](?![A-Za-z]))?|(${AMT_SP})\s?(${CUR})(?!\d)`, 'g');
/** A guaranteed prize pool or a bounty is not what the player paid. */
const GTD = /^\s*(?:gtd|guar|garant|prize\s*pool|pool|bount|mystery)/i;

// Symbols the CSV import has no use for (convert.ts currencyOf knows the rest).
const SYMBOL: Record<string, string> = { 'C$': 'CAD', 'CA$': 'CAD', 'AU$': 'A$', 'MX$': 'MXN', 'NZ$': 'NZD', 'S$': 'SGD', '¥': 'JPY', '₩': 'KRW', '₱': 'PHP', '₹': 'INR' };
const storedOf = (c: string) => SYMBOL[c] ?? currencyOf(c, '');

const DATES = [
  /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/,
  /\b\d{1,2}[-/.]\d{1,2}[-/.](?:\d{4}|\d{2})\b/,
  /\b\d{1,2}\.?[\s-]+(?:de\s+)?\p{L}{3,10}\.?[\s-]+(?:de\s+)?\d{4}\b/u,
  /(?<!\p{L})\p{L}{3,10}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/u,
];

/** The first date written in the text, where it is; "Jul 7th, 2024" loses its "th" to be read. */
function findDate(s: string): { index: number; length: number; token: string } | null {
  let best: { index: number; length: number; token: string } | null = null;
  for (const re of DATES) {
    const m = re.exec(s);
    if (!m || (best && best.index <= m.index)) continue;
    const token = m[0].replace(/(\d)(?:st|nd|rd|th)\b/, '$1');
    if (parseDate(token, 'dmy') || parseDate(token, 'mdy')) best = { index: m.index, length: m[0].length, token };
  }
  return best;
}

interface Money {
  index: number;
  end: number;
  amount: number;
  currency: string;
  /** Part of the event's name: words right after it ("$1,500 No-Limit") or in brackets ("(€1,100)"). */
  inName: boolean;
  /** "$1M GTD", "€500 bounty": never a buy-in. */
  gtd: boolean;
}

/** "12.400" or "1,500" on a results page is a thousand and more, never a decimal. */
function amountOf(num: string, mult = ''): number | null {
  let s = num.replace(/[   ]/g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  const n = parseNum(s);
  if (n === null) return null;
  const k = /k/i.test(mult) ? 1000 : /M/.test(mult) ? 1_000_000 : 1;
  return Math.round(n * k * 100) / 100;
}

function moneyIn(s: string): Money[] {
  const out: Money[] = [];
  for (const m of s.matchAll(MONEY)) {
    const amount = amountOf(m[2] ?? m[4], m[3]);
    if (amount === null || amount <= 0) continue;
    const index = m.index!;
    const end = index + m[0].length;
    const after = s.slice(end);
    const before = s.slice(0, index);
    const inName = /^[ ]*[+]?[ ]*\p{L}/u.test(after.replace(/^[ ]*\+[ ]*\S*\d/, '')) || (/\([ ]*$/.test(before) && /^[ ]*\)/.test(after));
    out.push({ index, end, amount, currency: storedOf(m[1] ?? m[5]), inName, gtd: GTD.test(after) || /\b(gtd|guaranteed?|garantid[oa]s?|garantizados?)\s*$/i.test(before) });
  }
  return out;
}

const PLACE_LABEL = /\b(?:place[d]?|position|pos\.?|posi[cç][aã]o|posici[oó]n|puesto|lugar|finish(?:ed)?|rank|classifica[cç][aã]o|clasificaci[oó]n)\s*[:#]?\s*(\d{1,5})(?![\d.,])/iu;
// "23rd", "1st", "5º", "5.º", "3ª", "1er", "2do", "3ro", "4to", "7mo", "8vo", "9no".
const ORDINAL_ALL = /(?<![\p{L}\d#.,/-])(\d{1,5})(?:st|nd|rd|th|er|ro|do|to|mo|vo|no|[èe]me|ᵉ|\s?\.?[ºª°])(?![\p{L}\d])/giu;
// French "3e": only when nothing else reads as a place, and only the first one ("100e" can be euros).
const ORDINAL_FR_E = /(?<![\p{L}\d#.,/-])(\d{1,4})e(?=\s)/u;
const PLACE_OF = /(?<![\p{L}\d#.,/-])(\d{1,5})\s?\/\s?(\d{1,3}(?:[.,]\d{3})+|\d{1,6})(?![\d.,/])/u;
const WINNER = /(?<!\p{L})(winner|champion|vencedor|campe[aã]o|ganador|campe[oó]n)(?!\p{L})/iu;
const FIELD_AFTER = /^\s*(?:\/|of|out of|de|em|en|sur)\s*(\d{1,3}(?:[.,\s]\d{3})+|\d{1,6})(?![\d.,])/i;
const FIELD_WORD = /\(?\b(\d{1,3}(?:[.,]\d{3})+|\d{1,6})\s*(?:entries|entrants|players|runners|jogadores|inscritos|participantes|jugadores|entradas)\b\)?|\b(?:entries|entrants|players|field|jogadores|inscritos|participantes|jugadores)\s*:?\s*(\d{1,3}(?:[.,]\d{3})+|\d{1,6})\b/i;
/** Before a bare number: it numbers the event, the day or the flight, not a place. */
const NOT_PLACE_BEFORE = /(?:event|evento|torneo|torneio|#|day|dia|d[ií]a|flight|n\.?º|no\.)\s*$/i;

const EVENT = /\b(event|evento|torneio|torneo|tournament|main|high\s*roller|nlh|plo|hold'?em|omaha|bounty|pko|turbo|deepstack|freezeout|championship|campeonato|re-?entry|day\s*\d)\b|#\s*\d/i;
const LABELS = /^(?:(?:prize|pr[eé]mio|premio|winnings|earnings|payout|event|evento|torneio|torneo|tournament|date|data|fecha|buy-?in)\s*:\s*)+|(?:\s*(?:prize|pr[eé]mio|premio|winnings|earnings|payout|buy-?in|place|lugar|puesto|posi[cç][aã]o|posici[oó]n)\s*:?)+$/giu;

/** Spaces of the same length over a part already read, so every other place stays where it was. */
const blank = (s: string, from: number, to: number) => s.slice(0, from) + s.slice(from, to).replace(/[^\t]/g, ' ') + s.slice(to);

const tidy = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(LABELS, '')
    .replace(/^[\s\-–—|,;:·.]+|[\s\-–—|,;:·(]+$/g, '')
    .trim();

// ─── Header row ──────────────────────────────────────────────────────────────

type Col = 'date' | 'name' | 'venue' | 'place' | 'prize' | 'buyIn' | 'field' | 'currency';

const HEAD: [Col, RegExp][] = [
  ['date', /^(date|data|fecha|dia|day|when|quando)$/],
  ['buyIn', /^(buyin|entry|entryfee|entrada|custo|coste|inscricao|inscripcion)/],
  ['place', /^(place|pos|position|posicao|posicion|puesto|lugar|finish|rank|rk|classificacao|clasificacion)$/],
  ['prize', /^(prize|winnings|earnings|cash|payout|amount|premio|ganancias|ganhos|ganho)/],
  ['field', /^(entries|entrants|players|field|runners|jogadores|inscritos|participantes|jugadores)$/],
  ['name', /^(event|evento|tournament|torneio|torneo|name|nome|nombre|title)/],
  ['venue', /^(venue|casino|location|local|sala|festival|series|serie|city|cidade|ciudad|where|onde)/],
  ['currency', /^(currency|moeda|moneda|cur)$/],
];
const colOf = (cell: string): Col | undefined => {
  const n = norm(cell);
  return n ? HEAD.find(([, re]) => re.test(n))?.[0] : undefined;
};

// ─── Text → rows ─────────────────────────────────────────────────────────────

interface Rec {
  line: number;
  cells: string[];
  lines: string[];
  /** Read from one line under a header row: its columns can be trusted. */
  single: boolean;
}

/**
 * Reads the pasted text. A row starts on a line with a date; lines after it without one are
 * the rest of that row (a phone copies each cell of a table onto its own line) while its prize
 * is still missing. Columns come from tabs, semicolons, " | " or two spaces; one line of words
 * ("12/03/2024 €550 Main Event 23rd €12.400") is read by what each part looks like.
 */
export function parseResults(text: string, opts: { order?: DateOrder; fallbackOrder?: DateOrder } = {}): ParsedResults {
  const s = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = s.split('\n');
  const sep = s.includes('\t') ? '\t' : detectSeparator(s) === ';' && lines.filter((l) => l.includes(';')).length * 2 >= lines.filter((l) => l.trim()).length ? ';' : null;
  const cellsOf = (l: string, by = sep): string[] => {
    if (by) return (parseCsv(l, by)[0] ?? []).map((c) => c.trim());
    if (l.includes('|')) return l.split('|').map((c) => c.trim());
    return l.split(/\s{2,}/).map((c) => c.trim());
  };

  // A header row names the columns: "Date  Event  Place  Prize", also with commas.
  let header: (Col | undefined)[] | null = null;
  let headerSep = sep;
  let headerAt = -1;
  for (let i = 0; i < Math.min(lines.length, 12) && !header; i++) {
    if (!lines[i].trim() || findDate(lines[i])) continue;
    for (const by of sep ? [sep] : [null, ',']) {
      const cols = cellsOf(lines[i], by).map(colOf);
      if (cols.filter(Boolean).length >= 2 && cols.length >= 2) {
        header = cols;
        headerSep = by;
        headerAt = i;
        break;
      }
    }
    // Words with single spaces ("Date Event Place Prize"): a header, but no columns to follow.
    if (!header && !/\d/.test(lines[i]) && lines[i].trim().split(/\s+/).filter((w) => colOf(w)).length >= 2) headerAt = i;
  }

  const records: Rec[] = [];
  const skipped: SkippedLine[] = [];
  let cur: Rec | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || i === headerAt) continue;
    const cells = cellsOf(l, header ? headerSep : sep);
    if (findDate(l)) {
      cur = { line: i + 1, cells, lines: [l], single: true };
      records.push(cur);
      continue;
    }
    const money = moneyIn(l);
    // The rest of the row above: its prize, place or a second line of its name.
    if (cur && (!readRecord(cur, header, 'dmy') || (money.length && !/\p{L}{3}/u.test(l.replace(new RegExp(CUR, 'g'), ''))))) {
      cur.cells.push(...cells);
      cur.lines.push(l);
      cur.single = false;
      continue;
    }
    // A line with an amount and no date: said, unless it's a total or the page's own text.
    if (money.length && !/\b(total|sum|soma|suma|lifetime|career|carreira)\b/i.test(l)) skipped.push({ line: i + 1, reason: 'noDate', value: l.trim().slice(0, 60) });
  }

  // dd/mm or mm/dd: the dates themselves first, then the money (dollars: an American page).
  const tokens = records.map((r) => findDate(r.cells.join('\t'))!.token);
  const dollars = records.filter((r) => /\$/.test(r.lines.join(' ')) && !/[€£]|R\$/.test(r.lines.join(' '))).length;
  const fallback = opts.fallbackOrder ?? (dollars * 2 > records.length ? 'mdy' : 'dmy');
  const order = opts.order ?? guessOrder(tokens, fallback);
  const ambiguousDates = tokens.some((tk) => {
    const a = parseDate(tk, 'dmy');
    const b = parseDate(tk, 'mdy');
    return !!a && !!b && a.t !== b.t;
  });

  const rows: ResultRow[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    const row = readRecord(r, header, order);
    if (!row) {
      skipped.push({ line: r.line, reason: 'noPrize', value: r.lines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 60) });
      continue;
    }
    // The same result pasted twice (two pages that overlap): once is enough.
    const key = [row.at, row.name.toLowerCase(), row.finish ?? '', row.prize, row.currency ?? ''].join('|');
    if (seen.has(key)) {
      skipped.push({ line: r.line, reason: 'repeat', value: row.text.slice(0, 60) });
      continue;
    }
    seen.add(key);
    rows.push(row);
  }
  skipped.sort((a, b) => a.line - b.line);
  return { rows, skipped, order, ambiguousDates };
}

/** One result from its cells, or null when it has no prize. */
function readRecord(r: Rec, header: (Col | undefined)[] | null, order: DateOrder): ResultRow | null {
  const text = r.cells.join('\t');
  let rest = text;
  const date = findDate(text)!;
  const when = parseDate(date.token, order) ?? parseDate(date.token, order === 'dmy' ? 'mdy' : 'dmy');
  if (!when) return null;
  rest = blank(rest, date.index, date.index + date.length);

  // Under a header, a row read from one line has its columns where the header says.
  const byCol = (c: Col): string | undefined => {
    if (!header || !r.single || r.cells.length !== header.length) return undefined;
    const i = header.indexOf(c);
    return i >= 0 ? r.cells[i] : undefined;
  };
  // Where each cell starts in the joined text, to blank one out once it's read.
  const starts: number[] = [];
  r.cells.reduce((at, c) => (starts.push(at), at + c.length + 1), 0);
  const blankCell = (c: Col) => {
    const i = header?.indexOf(c) ?? -1;
    if (byCol(c) !== undefined) cut(starts[i], starts[i] + r.cells[i].length);
  };

  // Amounts with a currency, then the place on what's left (so "1,500" is never a place).
  const money = moneyIn(rest);
  let masked = rest;
  for (const m of money) masked = blank(masked, m.index, m.end);
  // Read: off the name (rest) and out of the way of what is looked for next (masked).
  function cut(from: number, to: number) {
    rest = blank(rest, from, to);
    masked = blank(masked, from, to);
  }

  let finish: number | undefined;
  let placeEnd = -1;
  let placeSpan: [number, number] | null = null;
  const colPlace = byCol('place');
  if (colPlace !== undefined) {
    const m = /^(\d{1,5})/.exec(colPlace.replace(/[^\d]+$/, '').trim()) ?? (WINNER.test(colPlace) ? ['1', '1'] : null);
    if (m) finish = Number(m[1]);
    const i = header!.indexOf('place');
    placeSpan = [starts[i], starts[i] + r.cells[i].length];
  } else {
    // The last ordinal: "2nd Chance" in a name comes before the place.
    const m = PLACE_LABEL.exec(masked) ?? [...masked.matchAll(ORDINAL_ALL)].pop() ?? ORDINAL_FR_E.exec(masked) ?? null;
    const of = m ? null : PLACE_OF.exec(masked);
    if (m) {
      finish = Number(m[1]);
      placeSpan = [m.index, m.index + m[0].length];
    } else if (of && Number(of[1]) <= (amountOf(of[2]) ?? 0)) {
      // "23/456": the place and the field; the field is read from it below.
      finish = Number(of[1]);
      placeSpan = [of.index, of.index + of[1].length];
    } else {
      // A cell that is only a number: the place (the smaller of two, the other being the field).
      const ints = r.cells.map((c, i) => ({ i, n: /^\d{1,5}$/.test(c.trim()) && !/^(19|20)\d\d$/.test(c.trim()) ? Number(c) : NaN })).filter((x) => x.n > 0);
      const w = WINNER.exec(masked);
      if (ints.length) {
        const p = ints.reduce((a, b) => (b.n < a.n ? b : a));
        finish = p.n;
        placeSpan = [starts[p.i], starts[p.i] + r.cells[p.i].length];
      } else if (w) {
        finish = 1;
        placeSpan = [w.index, w.index + w[0].length];
      }
    }
  }
  if (placeSpan) {
    placeEnd = placeSpan[1];
    cut(placeSpan[0], placeSpan[1]);
  }

  // The field: "of 1,234" after the place, "(1,234 entries)", or its column.
  let field: number | undefined;
  const colField = byCol('field');
  if (colField !== undefined) {
    field = amountOf(colField.replace(/[^\d.,]/g, '')) ?? undefined;
    blankCell('field');
  } else {
    const after = placeEnd >= 0 ? FIELD_AFTER.exec(masked.slice(placeEnd)) : null;
    const m = after ? null : FIELD_WORD.exec(masked);
    if (after) {
      field = amountOf(after[1]) ?? undefined;
      cut(placeEnd, placeEnd + after[0].length);
    } else if (m) {
      field = amountOf(m[1] ?? m[2]) ?? undefined;
      cut(m.index, m.index + m[0].length);
    }
  }
  if (field !== undefined && (!Number.isInteger(field) || (finish !== undefined && field < finish))) field = undefined;

  // The prize: its column, else the first amount after the place (a second one is the page's
  // conversion to dollars), else the first one that isn't part of the event's name.
  let prize: Money | undefined;
  const colPrize = byCol('prize');
  if (colPrize !== undefined) {
    const m = moneyIn(colPrize)[0];
    const n = m?.amount ?? amountOf(colPrize.replace(/[^\d.,]/g, ''));
    if (n && n > 0) prize = { index: -1, end: -1, amount: n, currency: m?.currency ?? '', inName: false, gtd: false };
    blankCell('prize');
  } else {
    const usable = money.filter((m) => !m.gtd);
    prize = placeEnd >= 0 ? usable.find((m) => m.index >= placeEnd) : undefined;
    prize ??= usable.find((m) => !m.inName);
    if (!prize) {
      // No currency anywhere: a bare number right after the place is the prize (the player picks the currency).
      const bare = placeEnd >= 0 && !money.length ? /^[\s\t]*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d{3,}(?:[.,]\d{1,2})?)(?![\d.,])/.exec(masked.slice(placeEnd)) : null;
      if (bare) {
        const at = placeEnd + bare[0].indexOf(bare[1]);
        prize = { index: at, end: at + bare[1].length, amount: amountOf(bare[1]) ?? 0, currency: '', inName: false, gtd: false };
      }
    }
    // No place yet: a bare number just before the prize ("Main Event 23 €12,400").
    if (prize && prize.index >= 0 && finish === undefined) {
      const m = /(?:^|[\s\t])(\d{1,5})[\s\t]*[-–|:,]?[\s\t]*$/.exec(masked.slice(0, prize.index));
      if (m && !NOT_PLACE_BEFORE.test(masked.slice(0, m.index + m[0].indexOf(m[1])))) {
        finish = Number(m[1]);
        const at = m.index + m[0].indexOf(m[1]);
        cut(at, at + m[1].length);
      }
    }
  }
  if (!prize || prize.amount <= 0) return null;

  const colCur = byCol('currency');
  // The buy-in: its column, "Buy-in: $400", else the first amount in the event's name before the prize.
  let buyIn: Money | undefined;
  const colBuy = byCol('buyIn');
  if (colBuy !== undefined) {
    const m = moneyIn(colBuy)[0];
    const n = m?.amount ?? amountOf(colBuy.replace(/[^\d.,]/g, ''));
    if (n !== null && n >= 0 && colBuy.trim()) buyIn = { index: -1, end: -1, amount: n, currency: m?.currency ?? '', inName: true, gtd: false };
    blankCell('buyIn');
  } else {
    const before = money.filter((m) => !m.gtd && m !== prize && (prize!.index < 0 || m.index < prize!.index));
    buyIn = before.find((m) => /buy-?in|entrada|inscri/i.test(rest.slice(Math.max(0, m.index - 12), m.index))) ?? before.find((m) => m.inName || placeEnd < 0 || m.index < placeEnd);
    // "€500+50", "$1,500 + $100": buy-in and fee, one entry.
    if (buyIn) {
      const fee = new RegExp(String.raw`^[ ]*\+[ ]*(?:${CUR})?[ ]?(${AMT})`).exec(text.slice(buyIn.end));
      if (fee) buyIn = { ...buyIn, amount: buyIn.amount + (amountOf(fee[1]) ?? 0) };
    }
  }

  const currency = (colCur ? storedOf(colCur.trim()) : '') || prize.currency || buyIn?.currency || undefined;
  // A buy-in in another currency than the prize can't be told from a conversion: left to the player.
  const buy = buyIn && (!buyIn.currency || !currency || buyIn.currency === currency) ? Math.round(buyIn.amount * 100) / 100 : undefined;

  // What's left is the event and, in its own column, where it was played.
  // The prize and what follows it (the page's conversion to dollars) are not part of the name.
  if (prize.index >= 0) {
    rest = blank(rest, prize.index, prize.end);
    for (const m of money) if (m.index > prize.index) rest = blank(rest, m.index, m.end);
  }
  let name = byCol('name');
  let venue = byCol('venue');
  if (name !== undefined || venue !== undefined) {
    name = tidy(name ?? '');
    venue = tidy(venue ?? '');
  } else {
    const parts = rest
      .split('\t')
      .map(tidy)
      .filter((c) => /\p{L}/u.test(c));
    const withBuy = buyIn && buyIn.index >= 0 ? parts.find((c) => moneyIn(c).length) : undefined;
    const ev = withBuy ?? [...parts].reverse().find((c) => EVENT.test(c)) ?? parts.reduce<string | undefined>((a, c) => (!a || c.length > a.length ? c : a), undefined);
    name = ev ?? '';
    venue = parts.filter((c) => c !== ev).join(' · ');
  }
  if (!name) {
    name = venue || t('Torneio');
    venue = '';
  }
  return {
    line: r.line,
    at: new Date(when.t).setHours(12, 0, 0, 0),
    name: name.slice(0, 80).trim(),
    venue: venue.slice(0, 80).trim(),
    ...(finish && finish > 0 ? { finish } : null),
    ...(field && field > 0 ? { field } : null),
    prize: prize.amount,
    ...(currency ? { currency } : null),
    ...(buy !== undefined ? { buyIn: buy } : null),
    text: r.lines.join(' ').replace(/\s+/g, ' ').trim(),
  };
}

// ─── Rows → sessions ─────────────────────────────────────────────────────────

export interface CashListOptions {
  /** For rows the text gave no currency: the one the player picked. */
  currency: string;
  /** Buy-ins the player typed, by row line; a row's own buy-in wins over none, a typed one over both. */
  buyIns?: Record<number, number>;
  tableSize: number;
}

/** The currency a row is saved in. */
export const currencyOfRow = (r: ResultRow, fallback: string) => r.currency ?? fallback;

/** The buy-in a row is saved with, or undefined while nobody wrote one. */
export const buyInOf = (r: ResultRow, typed?: Record<number, number>) => typed?.[r.line] ?? r.buyIn;

/**
 * Sessions from the rows that have a buy-in (their own or typed); `waiting` are the rows
 * still without one. Same text twice gives the same ids, so a second paste adds nothing.
 */
export function cashSessions(rows: ResultRow[], opt: CashListOptions): { sessions: Session[]; waiting: ResultRow[] } {
  const sessions: Session[] = [];
  const waiting: ResultRow[] = [];
  for (const r of rows) {
    const buyIn = buyInOf(r, opt.buyIns);
    if (buyIn === undefined || !Number.isFinite(buyIn) || buyIn < 0) {
      waiting.push(r);
      continue;
    }
    const currency = currencyOfRow(r, opt.currency);
    const day = new Date(r.at);
    const id = 'imr_' + hash([day.getFullYear(), day.getMonth() + 1, day.getDate(), r.name.toLowerCase(), r.finish ?? '', r.prize, currency].join('|'));
    sessions.push({
      id,
      kind: 'mtt',
      name: r.name,
      venue: r.venue,
      currency,
      startedAt: r.at,
      // No hours on a results page: none counted, so no hourly rate is made up.
      endedAt: r.at,
      breaks: [],
      buyIn: Math.round(buyIn * 100) / 100,
      entries: 1,
      addOn: 0,
      cashOut: r.prize,
      finish: r.finish,
      field: r.field,
      sb: 0,
      bb: 0,
      ante: 0,
      anteType: 'none',
      tableSize: opt.tableSize,
      stack: 0,
      stackLog: [],
      roster: [],
      notes: '',
      cashList: true,
    });
  }
  return { sessions, waiting };
}

/** Prizes and buy-ins per currency, never added across currencies; most rows first. */
export function totalsByCurrency(rows: ResultRow[], opt: Pick<CashListOptions, 'currency' | 'buyIns'>): { currency: string; rows: number; prizes: number; buyIns: number; withBuyIn: number }[] {
  const m = new Map<string, { currency: string; rows: number; prizes: number; buyIns: number; withBuyIn: number }>();
  for (const r of rows) {
    const c = currencyOfRow(r, opt.currency);
    const x = m.get(c) ?? { currency: c, rows: 0, prizes: 0, buyIns: 0, withBuyIn: 0 };
    x.rows++;
    x.prizes = Math.round((x.prizes + r.prize) * 100) / 100;
    const b = buyInOf(r, opt.buyIns);
    if (b !== undefined) {
      x.buyIns = Math.round((x.buyIns + b) * 100) / 100;
      x.withBuyIn++;
    }
    m.set(c, x);
  }
  return [...m.values()].sort((a, b) => b.rows - a.rows || a.currency.localeCompare(b.currency));
}
