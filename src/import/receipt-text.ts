// The parts of a receipt the swap prize reader shares with the buy-in reader
// (receipt.ts): kept apart so the prize reader doesn't load the whole buy-in one.

import { CURRENCY_INFO } from '@/store/currencies';

import { parseNum } from './num';

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
export const BUYIN = /\b(buy[\s-]*in|inscri[cç][aã]o|inscripci[oó]n|entrada)\b/i;
export const FEE = /\b(fee|rake|taxa|comisi[oó]n|comiss[aã]o|admin|dealer\s*app|staff)\b/i;
export const TOTAL = /\b(total|amount\s*paid|paid|importe|valor\s*pago|pago|entry\s*fee)\b/i;
const EVENT = /\b(event|evento|torneio|torneo|tournament|main|high\s*roller|nlh|plo|hold'?em|omaha|bounty|pko|turbo|deepstack|freezeout)\b|#\s*\d/i;
// Lines that say what the paper is, not which event.
const GENERIC = /^(poker\s*)?(tournament|torneio|torneo)?\s*(receipt|recibo|ticket|comprovativo|comprobante|registration|inscri[cç][aã]o|inscripci[oó]n)?\s*$/i;
export const TABLE = /\b(table|mesa|tavolo|tisch|tbl)\.?\s*(?:n[ºo°.]?\s*)?[:#]?\s*(\d{1,4})\b/i;
export const SEAT = /\b(seat|lugar|asiento|assento|cadeira|posto|st)\.?\s*(?:n[ºo°.]?\s*)?[:#]?\s*(\d{1,2})\b/i;
export function currencyOf(text: string): string | undefined {
  for (const [re, v] of SYMBOLS) if (re.test(text)) return v;
  const code = text.match(/\b(EUR|USD|GBP|BRL|MXN|AUD|CAD|CHF|ARS|CLP|COP|PEN|JPY|KRW|PHP|SGD|ZAR)\b/);
  return code ? BY_CODE.get(code[1]) : undefined;
}

/** Every amount on a line, in order ("$2,500 + $200" → [2500, 200]). */
export function amounts(line: string): number[] {
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

export function eventName(lines: string[]): string | undefined {
  const cands = lines.filter((l) => EVENT.test(l) && !GENERIC.test(l) && !BUYIN.test(l) && !FEE.test(l) && !TOTAL.test(l) && !TABLE.test(l) && !SEAT.test(l) && /[a-z]/i.test(l));
  // "Event #5" beats a line that only says "Tournament".
  const best = cands.find((l) => /#\s*\d|event|evento/i.test(l)) ?? cands[0];
  if (!best) return undefined;
  const name = best.replace(/^(event|evento|torneio|torneo|tournament)\s*[:-]\s*/i, '').replace(/\s+/g, ' ').trim();
  // A day on its own line ("DAY 1A") belongs to the name.
  const day = lines.find((l) => /^\s*(day|dia|d[ií]a)\s*\d+[a-z]?\s*$/i.test(l));
  return name.length > 60 ? name.slice(0, 60).trim() : day && !/\b(day|dia|d[ií]a)\s*\d/i.test(name) ? `${name} ${day.trim()}` : name;
}
