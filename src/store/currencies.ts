// Every currency the app knows: what a session stores, how it shows, how many
// decimals it has and whether the ECB publishes a daily rate for it.
//
// The first seven are stored as symbols (older data); every newer one is
// stored as its ISO code, because "$", "¥" and "kr" mean several currencies.
// The symbol is only for display, with the country where it would be ambiguous.

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

/** Every stored value, picker order. */
export const CURRENCIES = Object.keys(CURRENCY_INFO);

/** What to show next to an amount; unknown values show as they are. */
export function symbolOf(cur: string): string {
  return CURRENCY_INFO[cur]?.symbol ?? cur;
}

export function decimalsOf(cur: string): 0 | 2 {
  return CURRENCY_INFO[cur]?.decimals ?? 2;
}

/** ISO code of a stored value (an unknown three-letter code is taken as one). */
export function isoOf(cur: string): string | undefined {
  return CURRENCY_INFO[cur]?.code ?? (/^[A-Z]{3}$/.test(cur) ? cur : undefined);
}

/** ISO codes the ECB publishes, EUR left out (it is the base). */
export const ECB_CODES = Object.values(CURRENCY_INFO)
  .filter((x) => x.ecb && x.code !== 'EUR')
  .map((x) => x.code);
