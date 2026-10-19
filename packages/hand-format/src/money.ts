// Money as each language writes it, shared by the app (src/poker/format.ts, src/store/currencies.ts)
// and the web pages, so an amount reads the same in both: "2500€" in Portugal, "R$ 2.500" in Brazil,
// "2500 €" in Spain, "$2,500" in English.
//
// The first seven currencies are stored as symbols (older data); every newer one is stored as its
// ISO code, because "$", "¥" and "kr" mean several currencies. The symbol is only for display, with
// the country where it would be ambiguous.

export interface CurrencyInfo {
  /** ISO 4217. */
  code: string;
  /** Shown next to amounts. */
  symbol: string;
  /** 0 for currencies without cents in practice (yen, won, peso chileno...). */
  decimals: 0 | 2;
  /** The ECB publishes a daily rate (via Frankfurter); otherwise the player types one. */
  ecb: boolean;
}

const c = (code: string, symbol: string, decimals: 0 | 2 = 2, ecb = true): CurrencyInfo => ({ code, symbol, decimals, ecb });

/** Stored value → info, in the order the pickers show them. */
export const CURRENCY_INFO: Record<string, CurrencyInfo> = {
  '€': c('EUR', '€'),
  $: c('USD', '$'),
  '£': c('GBP', '£'),
  R$: c('BRL', 'R$'),
  CHF: c('CHF', 'CHF'),
  HK$: c('HKD', 'HK$'),
  A$: c('AUD', 'A$'),
  CAD: c('CAD', 'CA$'),
  MXN: c('MXN', 'MX$'),
  JPY: c('JPY', '¥', 0),
  SGD: c('SGD', 'S$'),
  PHP: c('PHP', '₱'),
  KRW: c('KRW', '₩', 0),
  NZD: c('NZD', 'NZ$'),
  SEK: c('SEK', 'SEK'),
  NOK: c('NOK', 'NOK'),
  DKK: c('DKK', 'DKK'),
  PLN: c('PLN', 'zł'),
  CZK: c('CZK', 'Kč'),
  INR: c('INR', '₹'),
  ZAR: c('ZAR', 'ZAR'),
  // No ECB rate: the player types one (Settings.fxManual, or the trip's rate).
  ARS: c('ARS', 'AR$', 2, false),
  CLP: c('CLP', 'CLP$', 0, false),
  COP: c('COP', 'COL$', 0, false),
  PEN: c('PEN', 'S/', 2, false),
  UYU: c('UYU', '$U', 2, false),
  MOP: c('MOP', 'MOP$', 2, false),
  VND: c('VND', '₫', 0, false),
};

/** What to show next to an amount; unknown values show as they are. */
export function symbolOf(cur: string): string {
  return CURRENCY_INFO[cur]?.symbol ?? cur;
}

export function decimalsOf(cur: string): 0 | 2 {
  return CURRENCY_INFO[cur]?.decimals ?? 2;
}

/** The languages the app and the site speak. */
export type MoneyVariant = 'pt-PT' | 'pt-BR' | 'en' | 'es';

/** How one language writes numbers and money. */
export type LocaleFormat = {
  /** BCP 47 tag for Intl dates and numbers. */
  locale: string;
  /** Writes 3,5 rather than 3.5. */
  decimalComma: boolean;
  /** Money reads "370 €" (Portugal, Spain) rather than "$370" / "R$ 370". */
  currencyAfter: boolean;
  /** Between the amount and the symbol: Portugal keeps "370€" short, Brazil and Spain use a no-break space. */
  currencySpace: string;
};

/** The number and money format for a language. Spanish keeps the device's region (es-MX writes $1,234.50). */
export function localeFormat(v: MoneyVariant, tag?: string): LocaleFormat {
  const locale =
    v === 'pt-PT' ? 'pt-PT'
    : v === 'pt-BR' ? 'pt-BR'
    : v === 'es' ? (tag?.toLowerCase().startsWith('es') ? tag : 'es-ES')
    : 'en-GB';
  let decimalComma: boolean;
  try {
    decimalComma = new Intl.NumberFormat(locale).format(1.5).includes(',');
  } catch {
    decimalComma = v !== 'en';
  }
  const spain = v === 'es' && /^es(-ES)?$/i.test(locale);
  return {
    locale,
    decimalComma,
    currencyAfter: v === 'pt-PT' || spain,
    currencySpace: v === 'pt-BR' || spain ? '\u00a0' : '',
  };
}

/**
 * Money as one language writes it: "370€" and "12,50€" in Portugal, "R$ 1.235" in
 * Brazil, "12.345 €" in Spain, "$1,235" in English and Mexico. To the cent at any size:
 * whole amounts stay clean ("1250€"), cents show two digits when there are any ("3744,33 $"),
 * never a bare JS decimal point.
 */
export function moneyIn(
  f: LocaleFormat,
  n: number,
  currency: string,
  num: (digits?: number) => Intl.NumberFormat = (d) => new Intl.NumberFormat(f.locale, d === undefined ? undefined : { minimumFractionDigits: d, maximumFractionDigits: d }),
): string {
  // Yen, won and the like have no cents: always whole.
  const a = decimalsOf(currency) ? Math.abs(n) : Math.round(Math.abs(n));
  const sign = n < 0 && a > 0 ? '−' : '';
  const cents = Math.round(a * 100);
  // A backer's 3744,33 is what they are owed, not 3744: cents stay from 1000 up too.
  const s = cents % 100 === 0 ? num().format(cents / 100) : num(2).format(cents / 100);
  const sym = symbolOf(currency);
  // Letter codes (CHF, SEK) always need a space; symbols follow the language.
  const gap = /^[A-Za-z]{2,}$/.test(sym) ? ' ' : f.currencySpace;
  return f.currencyAfter ? `${sign}${s}${gap}${sym}` : `${sign}${sym}${gap}${s}`;
}

/** A balance settled to the cent: "0,00€", so it reads as squared up, not as a missing value. Currencies without cents stay "0¥". */
export function settledIn(
  f: LocaleFormat,
  currency: string,
  num: (digits?: number) => Intl.NumberFormat = (d) => new Intl.NumberFormat(f.locale, d === undefined ? undefined : { minimumFractionDigits: d, maximumFractionDigits: d }),
): string {
  return moneyIn(f, 0, currency, (d) => num(d ?? (decimalsOf(currency) ? 2 : undefined)));
}
