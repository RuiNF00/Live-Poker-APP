import { FORMAT, locale, type LocaleFormat } from '../i18n';
import { decimalsOf, symbolOf } from '../store/currencies';

import type { ActionKind, Hand } from './types';

// toLocaleString builds a new formatter on every call, which is slow (most of
// all on Hermes) and runs for every row of the hands list. Same output, one
// formatter each, made on first use.
const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function numFmt(digits?: number): Intl.NumberFormat {
  const k = 'n' + (digits ?? '');
  let f = formatters.get(k) as Intl.NumberFormat | undefined;
  if (!f) formatters.set(k, (f = new Intl.NumberFormat(locale, digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits })));
  return f;
}
function dateFmt(k: 'day' | 'time'): Intl.DateTimeFormat {
  let f = formatters.get(k) as Intl.DateTimeFormat | undefined;
  if (!f) formatters.set(k, (f = new Intl.DateTimeFormat(locale, k === 'day' ? { day: '2-digit', month: 'short' } : { hour: '2-digit', minute: '2-digit' })));
  return f;
}

function trim(n: number, digits: number) {
  const s = n.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  // "12,5k" and "2,5 bb" where the language writes a decimal comma.
  return FORMAT.decimalComma ? s.replace('.', ',') : s;
}

/** 950 → "950", 12500 → "12.5k", 1250000 → "1.25M". */
export function chips(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a < 10000) return sign + numFmt().format(Math.round(a)).replace(/\s/g, ' ');
  if (a < 1e6) return sign + trim(a / 1000, a < 100000 ? 1 : 0) + 'k';
  return sign + trim(a / 1e6, 2) + 'M';
}

export function bbs(n: number, bb: number): string {
  if (!bb) return chips(n);
  const v = n / bb;
  return trim(v, Math.abs(v) < 10 ? 1 : Math.abs(v) < 100 ? 1 : 0) + ' bb';
}

export function amount(n: number, hand: Pick<Hand, 'game'>, inBB: boolean): string {
  return inBB ? bbs(n, hand.game.bb) : chips(n);
}

let masked = false;
/** Privacy mode (Settings): every amount on screen shows as •••. Set by the store. */
export function setMoneyMasked(v: boolean) {
  masked = v;
}
export const moneyMasked = () => masked;
export const MASK = '•••';

/** An amount for the screen: ••• in privacy mode. Files, reports and share images use rawMoney. */
export function money(n: number, currency = '€'): string {
  return masked ? MASK : rawMoney(n, currency);
}

export function rawMoney(n: number, currency = '€'): string {
  return moneyIn(FORMAT, n, currency, numFmt);
}

/**
 * Money as one language writes it: "370€" and "1234,50€" in Portugal, "R$ 1.234,50"
 * in Brazil, "1234,50 €" in Spain, "$1,234.50" in English and Mexico. Whole amounts
 * stay short; cents always show two digits, never a bare JS decimal point.
 */
export function moneyIn(f: LocaleFormat, n: number, currency: string, num: (digits?: number) => Intl.NumberFormat = (d) => new Intl.NumberFormat(f.locale, d === undefined ? undefined : { minimumFractionDigits: d, maximumFractionDigits: d })): string {
  // Yen, won and the like have no cents: always whole.
  const a = decimalsOf(currency) ? Math.abs(n) : Math.round(Math.abs(n));
  const sign = n < 0 && a > 0 ? '−' : '';
  const cents = Math.round(a * 100);
  const s = a >= 1000 ? num().format(Math.round(a)) : cents % 100 === 0 ? String(cents / 100) : num(2).format(cents / 100);
  const sym = symbolOf(currency);
  // Letter codes (CHF, SEK) always need a space; symbols follow the language.
  const gap = /^[A-Za-z]{2,}$/.test(sym) ? ' ' : f.currencySpace;
  return f.currencyAfter ? `${sign}${s}${gap}${sym}` : `${sign}${sym}${gap}${s}`;
}

/** A plain decimal in the app's language: 3,5 in Portuguese and Spain, 3.5 in English. */
export function decimal(x: number, digits = 1): string {
  return numFmt(digits).format(x);
}

/** "162k€" / "$162k": a short amount for a tile, with the currency where money() puts it in this language. */
export function compactMoney(n: number, currency = '€'): string {
  if (masked) return MASK;
  const sign = n < 0 && Math.round(Math.abs(n)) > 0 ? '−' : '';
  return sign + rawMoney(1, currency).replace('1', chips(Math.abs(n)));
}

export const ACTION_LABEL: Record<ActionKind, string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  bet: 'Bet',
  raise: 'Raise',
};

/** A 0..1 share as a percentage in the app's language: "84,7%" in Portuguese, "84.7%" in English. */
export function pct(x: number, digits = 0): string {
  return numFmt(digits).format(x * 100) + '%';
}

export function blindsLabel(hand: Pick<Hand, 'game'>): string {
  const g = hand.game;
  if (g.bombPot) return `${chips(g.sb)}/${chips(g.bb)} · bomb ${chips(g.bombPot)}`;
  const base = `${chips(g.sb)}/${chips(g.bb)}` + (g.straddles ? `/${chips(g.bb * 2 ** (g.straddleFrom === 'btn' ? 1 : g.straddles))}` : '');
  if (g.ante > 0 && g.anteType !== 'none') return `${base} (${chips(g.ante)})`;
  return base;
}

export function duration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h${String(mm).padStart(2, '0')}` : `${mm}min`;
}

export function shortDate(ts: number): string {
  return dateFmt('day').format(ts);
}

export function timeOf(ts: number): string {
  return dateFmt('time').format(ts);
}
