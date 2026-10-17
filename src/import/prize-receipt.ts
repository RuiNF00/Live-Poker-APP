// A tournament payout slip (what the cashier hands over with the prize), read from the lines
// the phone's text recognition found in the photo. Fills a swap result: the prize, the place,
// the event. Pure, so it can be tested: what can't be read is left out, never guessed.

import { amounts, currencyOf, eventName } from './receipt';

export interface PrizeGuess {
  /** The whole prize, before any tax held back (the swap is on the prize). */
  amount?: number;
  finish?: number;
  event?: string;
  currency?: string;
}

const PRIZE = /\b(gross|prize|pr[eé]mio|premio|payout|pay\s*out|winnings|amount\s*won|ganancia|ganhos|cash(?:ed)?\s*amount)\b/i;
const NET = /\b(net|l[ií]quido|neto|a\s*receber|to\s*pay|a\s*pagar)\b/i;
const TAX = /\b(tax|withh(?:e|o)ld|withholding|imposto|irs|irpf|reten[cç](?:[aã]o|i[oó]n)|selo)\b/i;
const TOTAL = /\b(total|amount|importe|valor)\b/i;
const NOT_PRIZE = /\b(buy[\s-]*in|fee|rake|entry|inscri[cç][aã]o|inscripci[oó]n|entries|players|jogadores|jugadores|prize\s*pool|pool|chips|fichas|table|mesa|seat|id|ticket|nif|nie|passport|passaporte|doc)\b/i;
const PLACE = /\b(place|position|pos\.|posi[cç][aã]o|posici[oó]n|puesto|lugar|finish(?:ed)?|classifica[cç][aã]o|clasificaci[oó]n|rank)\b\s*(?:n[ºo°.]?\s*)?[:#]?\s*(\d{1,5})\b/i;
const ORDINAL = /\b(\d{1,5})\s*(?:st|nd|rd|th|º|ª|°)(?![a-z0-9])/i;
// "7th place", "7º lugar", or "7th" alone on its line.
const ORDINAL_LINE = /(place|lugar|puesto|posi[cç])/i;

function after(line: string, label: RegExp): number[] {
  const m = line.match(label);
  return m ? amounts(line.slice((m.index ?? 0) + m[0].length)) : [];
}

function firstLabeled(lines: string[], ok: (l: string) => boolean, label: RegExp): number | undefined {
  for (const l of lines) {
    if (!ok(l)) continue;
    const a = after(l, label);
    if (a.length) return a[0];
  }
  return undefined;
}

export function parsePrizeReceipt(raw: string[]): PrizeGuess {
  const lines = raw.flatMap((l) => l.split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);
  const text = lines.join('\n');
  const g: PrizeGuess = {};

  const currency = currencyOf(text);
  if (currency) g.currency = currency;

  // The place first: its line is not a prize line.
  let placeLine = -1;
  for (const [i, l] of lines.entries()) {
    const m = l.match(PLACE) ?? (ORDINAL_LINE.test(l) || /^\s*\d{1,5}\s*(?:st|nd|rd|th|º|ª|°)\s*$/i.test(l) ? l.match(ORDINAL) : null);
    if (!m) continue;
    // PLACE: [line, label, n]. ORDINAL: [line, n].
    const n = Number(m[m.length - 1]);
    if (n >= 1 && n <= 100000) {
      g.finish = n;
      placeLine = i;
      break;
    }
  }
  const usable = lines.filter((l, i) => i !== placeLine && !TAX.test(l));

  // The gross prize, then a net one, then a total; never a tax line or the buy-in.
  const amount =
    firstLabeled(usable, (l) => PRIZE.test(l) && !NET.test(l) && !/\bpool\b/i.test(l), PRIZE) ??
    firstLabeled(usable, (l) => NET.test(l), NET) ??
    firstLabeled(usable, (l) => TOTAL.test(l) && !NOT_PRIZE.test(l), TOTAL) ??
    // No labels at all: the one amount on the slip, or the biggest when there are a few.
    Math.max(0, ...usable.filter((l) => !NOT_PRIZE.test(l)).flatMap(amounts));
  if (amount && amount > 0) g.amount = Math.round(amount * 100) / 100;

  const event = eventName(lines.filter((l, i) => i !== placeLine && !PRIZE.test(l) && !TAX.test(l)));
  if (event) g.event = event;
  return g;
}
