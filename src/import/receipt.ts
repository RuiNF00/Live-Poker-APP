// A tournament buy-in receipt (the paper ticket from registration), read from
// the lines the phone's text recognition found in the photo. Pure, so it can
// be tested: what can't be read is left out, never guessed.

import { t } from '@/i18n';
import { CURRENCY_INFO } from '@/store/currencies';
import type { Bankroll, Session, SessionDoc } from '@/store/types';

import { parseNum } from './num';

export interface ReceiptGuess {
  name?: string;
  /** Stored currency value ('€', '$', 'MXN'…). */
  currency?: string;
  /** What one entry cost, fee included (the app's buy-in). */
  buyIn?: number;
  fee?: number;
  /** Start of the day the receipt is for, at the time on it when there is one. */
  date?: number;
  hasTime?: boolean;
  table?: number;
  seat?: number;
  stack?: number;
}

const SYMBOLS: [RegExp, string][] = [
  [/R\$/, 'R$'],
  [/MX\$/, 'MXN'],
  [/A\$/, 'A$'],
  [/HK\$/, 'HK$'],
  [/€/, '€'],
  [/£/, '£'],
  [/\$/, '$'],
];
const BY_CODE = new Map(Object.entries(CURRENCY_INFO).map(([stored, i]) => [i.code, stored]));

const MONEY = /([-+]?\s*(?:R\$|MX\$|A\$|HK\$|[€£$])?\s*\d[\d.,\s]*\d|\d)\s*(?:€|£|\$|[A-Z]{3}\b)?/;
const BUYIN = /\b(buy[\s-]*in|inscri[cç][aã]o|inscripci[oó]n|entrada)\b/i;
const FEE = /\b(fee|rake|taxa|comisi[oó]n|comiss[aã]o|admin|dealer\s*app|staff)\b/i;
const TOTAL = /\b(total|amount\s*paid|paid|importe|valor\s*pago|pago|entry\s*fee)\b/i;
const EVENT = /\b(event|evento|torneio|torneo|tournament|main|high\s*roller|nlh|plo|hold'?em|omaha|bounty|pko|turbo|deepstack|freezeout)\b|#\s*\d/i;
// Lines that say what the paper is, not which event.
const GENERIC = /^(poker\s*)?(tournament|torneio|torneo)?\s*(receipt|recibo|ticket|comprovativo|comprobante|registration|inscri[cç][aã]o|inscripci[oó]n)?\s*$/i;
const TABLE = /\b(table|mesa|tavolo|tisch|tbl)\.?\s*(?:n[ºo°.]?\s*)?[:#]?\s*(\d{1,4})\b/i;
const SEAT = /\b(seat|lugar|asiento|assento|cadeira|posto|st)\.?\s*(?:n[ºo°.]?\s*)?[:#]?\s*(\d{1,2})\b/i;
const STACK = /\b(starting\s*(?:chips|stack)|chips|stack\s*inicial|fichas(?:\s*iniciais|\s*iniciales)?)\b\D{0,6}([\d][\d.,\s]*\d)/i;
const MONTHS: Record<string, number> = {
  jan: 0, ene: 0, feb: 1, fev: 1, mar: 2, apr: 3, abr: 3, may: 4, mai: 4, jun: 5, jul: 6, aug: 7, ago: 7, sep: 8, set: 8, oct: 9, out: 9, nov: 10, dec: 11, dez: 11, dic: 11,
};

function currencyOf(text: string): string | undefined {
  for (const [re, v] of SYMBOLS) if (re.test(text)) return v;
  const code = text.match(/\b(EUR|USD|GBP|BRL|MXN|AUD|CAD|CHF|ARS|CLP|COP|PEN|JPY|KRW|PHP|SGD|ZAR)\b/);
  return code ? BY_CODE.get(code[1]) : undefined;
}

/** Every amount on a line, in order ("$2,500 + $200" → [2500, 200]). */
function amounts(line: string): number[] {
  const out: number[] = [];
  // Times, dates and "#12" are not amounts.
  const clean = line.replace(/\b\d{1,2}:\d{2}\b/g, ' ').replace(/\b\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, ' ').replace(/#\s*\d+/g, ' ');
  const re = new RegExp(MONEY.source, 'g');
  for (const m of clean.matchAll(re)) {
    let tok = m[1].replace(/\s+/g, '');
    // "1.100" on a receipt is a thousand and a hundred, never one point one.
    if (/^[^\d]*\d{1,3}(\.\d{3})+$/.test(tok)) tok = tok.replace(/\./g, '');
    const n = parseNum(tok);
    if (n !== null && n > 0) out.push(n);
  }
  return out;
}

function afterLabel(line: string, label: RegExp): number[] {
  const m = line.match(label);
  return m ? amounts(line.slice((m.index ?? 0) + m[0].length)) : [];
}

function dateOf(text: string, usFirst: boolean): { t: number; hasTime: boolean } | null {
  let y: number | undefined, mo: number | undefined, d: number | undefined;
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  const num = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  const named = text.match(/\b(\d{1,2})\s*(?:de\s*)?([a-zç]{3})[a-zç]*\.?\s*(?:de\s*)?,?\s*(20\d{2})\b/i) ?? null;
  const namedUs = text.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])];
  else if (num) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    y = num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3]);
    // Day first unless that can't be, or the receipt is in dollars and either reading works.
    const mdy = a <= 12 && (b > 12 || (usFirst && b <= 12));
    [mo, d] = mdy ? [a - 1, b] : [b - 1, a];
  } else if (named && MONTHS[named[2].toLowerCase()] !== undefined) [d, mo, y] = [Number(named[1]), MONTHS[named[2].toLowerCase()], Number(named[3])];
  else if (namedUs && MONTHS[namedUs[1].toLowerCase()] !== undefined) [mo, d, y] = [MONTHS[namedUs[1].toLowerCase()], Number(namedUs[2]), Number(namedUs[3])];
  if (y === undefined || mo === undefined || d === undefined || mo > 11 || d < 1 || d > 31) return null;
  const at = new Date(y, mo, d);
  if (at.getMonth() !== mo) return null;
  const tm = text.match(/\b(\d{1,2})[:h](\d{2})\s*(am|pm)?\b/i);
  if (tm) {
    let h = Number(tm[1]);
    const pm = tm[3]?.toLowerCase();
    if (pm === 'pm' && h < 12) h += 12;
    if (pm === 'am' && h === 12) h = 0;
    if (h < 24) at.setHours(h, Number(tm[2]), 0, 0);
  }
  return { t: at.getTime(), hasTime: !!tm };
}

function eventName(lines: string[]): string | undefined {
  const cands = lines.filter((l) => EVENT.test(l) && !GENERIC.test(l) && !BUYIN.test(l) && !FEE.test(l) && !TOTAL.test(l) && !TABLE.test(l) && !SEAT.test(l) && /[a-z]/i.test(l));
  // "Event #5" beats a line that only says "Tournament".
  const best = cands.find((l) => /#\s*\d|event|evento/i.test(l)) ?? cands[0];
  if (!best) return undefined;
  const name = best.replace(/^(event|evento|torneio|torneo|tournament)\s*[:-]\s*/i, '').replace(/\s+/g, ' ').trim();
  // A day on its own line ("DAY 1A") belongs to the name.
  const day = lines.find((l) => /^\s*(day|dia|d[ií]a)\s*\d+[a-z]?\s*$/i.test(l));
  return name.length > 60 ? name.slice(0, 60).trim() : day && !/\b(day|dia|d[ií]a)\s*\d/i.test(name) ? `${name} ${day.trim()}` : name;
}

export function parseReceipt(raw: string[]): ReceiptGuess {
  const lines = raw.flatMap((l) => l.split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);
  const text = lines.join('\n');
  const g: ReceiptGuess = {};

  const currency = currencyOf(text);
  if (currency) g.currency = currency;

  let buyIn: number | undefined;
  let fee: number | undefined;
  let total: number | undefined;
  for (const l of lines) {
    if (BUYIN.test(l) && buyIn === undefined) {
      const a = afterLabel(l, BUYIN);
      if (a.length) {
        buyIn = a[0];
        // "Buy-in: 2,500 + 200" on one line.
        if (a.length > 1 && /\+/.test(l)) fee = a[1];
        // "Buy-in $2,500   Fee $200" on one line.
        else if (FEE.test(l)) fee = afterLabel(l, FEE)[0];
      }
    } else if (TOTAL.test(l) && total === undefined) {
      // Before the fee: "Entry fee" is what the whole entry cost.
      const a = afterLabel(l, TOTAL);
      if (a.length) total = a[a.length - 1];
    } else if (FEE.test(l) && fee === undefined) {
      const a = afterLabel(l, FEE);
      if (a.length) fee = a[0];
    }
  }
  // No labels: "$1,500 + $100" anywhere.
  if (buyIn === undefined && total === undefined) {
    const plus = lines.find((l) => /\d\s*[€£$]?\s*\+\s*[€£$]?\s*\d/.test(l));
    const a = plus ? amounts(plus) : [];
    if (a.length >= 2) [buyIn, fee] = a;
  }
  const sum = buyIn !== undefined ? buyIn + (fee ?? 0) : undefined;
  // The total paid wins when it adds up or nothing else was found; a total far
  // off the buy-in is probably a running balance, so the buy-in stays.
  const cost = total !== undefined && (sum === undefined || Math.abs(total - sum) < 0.01 || total >= sum) ? total : sum;
  if (cost !== undefined && cost > 0) g.buyIn = Math.round(cost * 100) / 100;
  if (fee !== undefined) g.fee = fee;

  const name = eventName(lines);
  if (name) g.name = name;

  const when = dateOf(text, currency === '$');
  if (when) {
    g.date = when.t;
    g.hasTime = when.hasTime;
  }
  const table = text.match(TABLE);
  if (table) g.table = Number(table[2]);
  const seat = text.match(SEAT);
  if (seat && Number(seat[2]) >= 1 && Number(seat[2]) <= 10) g.seat = Number(seat[2]);
  const stack = text.match(STACK);
  if (stack) {
    const n = parseNum(stack[2].replace(/\s+/g, ''));
    if (n && n >= 1000) g.stack = n;
  }
  return g;
}

/** Enough to start the tournament from it: what it cost. The rest is a bonus. */
export const usable = (g: ReceiptGuess) => g.buyIn !== undefined;

/** "Mesa 45 · Lugar 7", for the session notes (the app has no table or seat field). */
export function seatLine(g: ReceiptGuess): string {
  return [g.table !== undefined ? t('Mesa {n}', { n: g.table }) : '', g.seat !== undefined ? t('Lugar {n}', { n: g.seat }) : ''].filter(Boolean).join(' · ');
}

const dayOf = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

/** A receipt for an earlier day: the tournament is logged as played, not started now. */
export const isPast = (g: ReceiptGuess, now = Date.now()) => g.date !== undefined && dayOf(g.date) < dayOf(now);

/**
 * The tournament the receipt describes, over a blank one. The currency comes
 * from the receipt (into a bankroll in it, when there is one); what the
 * receipt doesn't say keeps the blank's value.
 */
export function applyReceipt(base: Session, g: ReceiptGuess, doc: SessionDoc | null, bankrolls: Bankroll[], now = Date.now()): Session {
  const currency = g.currency ?? base.currency;
  const bankroll = currency === base.currency && base.bankrollId ? bankrolls.find((b) => b.id === base.bankrollId) : bankrolls.find((b) => b.currency === currency);
  const seat = seatLine(g);
  const s: Session = {
    ...base,
    kind: 'mtt',
    name: g.name ?? base.name,
    currency,
    bankrollId: bankroll?.id,
    buyIn: g.buyIn ?? base.buyIn,
    stack: g.stack ?? base.stack,
    notes: [seat, base.notes].filter(Boolean).join('\n'),
    docs: doc ? [...(base.docs ?? []), doc] : base.docs,
  };
  if (isPast(g, now)) {
    // No time on it: an evening start, like a day with no clock in an import.
    const start = g.hasTime ? g.date! : new Date(g.date!).setHours(18, 0, 0, 0);
    return { ...s, startedAt: start, endedAt: start + 4 * 3600000 };
  }
  return s;
}
