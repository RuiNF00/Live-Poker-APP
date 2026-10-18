// What the purchase screens must say (App Store 3.1.2, Google Play subscriptions policy),
// kept pure so it can be tested: the legal links in the player's language and the numbers
// derived from store offers. Prices themselves always come from the store.

type Variant = 'pt-PT' | 'pt-BR' | 'en' | 'es';

/** Apple and Google require these links next to the subscribe button. One page per document, a section per language. */
export const LEGAL = {
  terms: 'https://sweatbook.poker/terms.html',
  privacy: 'https://sweatbook.poker/privacy.html',
};

/** The section ids in web/public/terms.html and privacy.html; English is the top of the page. */
const ANCHOR: Record<Variant, string> = { en: '', 'pt-PT': '#pt', 'pt-BR': '#pt-br', es: '#es' };

/** The Terms of Use (EULA) or Privacy Policy, opened at the player's language. */
export function legalUrl(page: keyof typeof LEGAL, variant: Variant): string {
  return LEGAL[page] + (ANCHOR[variant] ?? '');
}

/**
 * Months a store offer lasts (cycles × period), or null when the store doesn't say it in
 * months. The cancel flow writes "durante {n} meses" from this, so it never disagrees
 * with what the store charges.
 */
export function offerMonths(unit: string | null | undefined, units: number | null | undefined, cycles: number | null | undefined): number | null {
  if (!units || !cycles || units < 1 || cycles < 1) return null;
  const perCycle = unit === 'MONTH' ? units : unit === 'YEAR' ? units * 12 : null;
  return perCycle === null ? null : perCycle * cycles;
}

/** Percent off between two store prices, or null when either is missing (never compared with a made-up price). */
export function pctOff(full: number | null | undefined, paid: number | null | undefined): number | null {
  if (!full || paid === null || paid === undefined || full <= 0 || paid < 0 || paid >= full) return null;
  // Floored: never more discount than the real one (¥4,400 → ¥2,600 is −40%, not −41%).
  return Math.floor((1 - paid / full) * 100 + 1e-9);
}
