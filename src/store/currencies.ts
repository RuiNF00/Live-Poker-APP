// Every currency the app knows: what a session stores, how it shows, how many
// decimals it has and whether the ECB publishes a daily rate for it.
//
// The first seven are stored as symbols (older data); every newer one is
// stored as its ISO code, because "$", "¥" and "kr" mean several currencies.
// The symbol is only for display, with the country where it would be ambiguous.

import { CURRENCY_INFO } from '../../packages/hand-format/src/money';

export { CURRENCY_INFO, decimalsOf, symbolOf, type CurrencyInfo } from '../../packages/hand-format/src/money';

/** Every stored value, picker order. */
export const CURRENCIES = Object.keys(CURRENCY_INFO);

/** ISO code of a stored value (an unknown three-letter code is taken as one). */
export function isoOf(cur: string): string | undefined {
  return CURRENCY_INFO[cur]?.code ?? (/^[A-Z]{3}$/.test(cur) ? cur : undefined);
}

/** ISO codes the ECB publishes, EUR left out (it is the base). */
export const ECB_CODES = Object.values(CURRENCY_INFO)
  .filter((x) => x.ecb && x.code !== 'EUR')
  .map((x) => x.code);
