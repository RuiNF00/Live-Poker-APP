// Portuguese is the source language: every string in the app is written in
// pt-PT and that text is its own key. The other languages are tables keyed by
// that text: en.ts and es.ts translate every string, pt-BR.ts holds only the
// strings that read differently in Brazil. A missing entry falls back to the
// closest language (pt-BR to pt-PT, es to English, English to pt-PT);
// src/i18n/__tests__ and scripts/i18n-missing.ts list what is missing.

import en from './en';
import es from './es';
import ptBR from './pt-BR';

/** The language family, for grammar and formatting branches. */
export type Lang = 'pt' | 'en' | 'es';
/** The exact language the app speaks. */
export type Variant = 'pt-PT' | 'pt-BR' | 'en' | 'es';

export const VARIANTS: readonly Variant[] = ['pt-PT', 'pt-BR', 'en', 'es'];

/** Each language's name in itself, for the language picker. */
export const VARIANT_NAME: Record<Variant, string> = {
  'pt-PT': 'Português (Portugal)',
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  es: 'Español',
};

/** Web only: the language picked in Settings. Phones use the system's per-app language. */
export const LANG_KEY = 'rl.lang.v1';

type DeviceLocale = { languageCode?: string | null; regionCode?: string | null; languageTag?: string | null };

/** The first of the device's preferred languages the app speaks; English when none. */
export function resolve(locales: readonly DeviceLocale[]): { variant: Variant; tag?: string } {
  for (const l of locales) {
    const code = l.languageCode?.toLowerCase();
    const tag = l.languageTag ?? undefined;
    if (code === 'pt') {
      const region = (l.regionCode ?? tag?.split(/[-_]/)[1] ?? '').toUpperCase();
      return { variant: region === 'BR' ? 'pt-BR' : 'pt-PT', tag };
    }
    if (code === 'es') return { variant: 'es', tag };
    if (code === 'en') return { variant: 'en', tag };
  }
  return { variant: locales.length ? 'en' : 'pt-PT' };
}

function picked(): Variant | undefined {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;
    if (v === 'pt') return 'pt-PT'; // saved before pt-BR and es existed
    return VARIANTS.find((x) => x === v);
  } catch {
    // Storage blocked: fall through to the device language.
    return undefined;
  }
}

function detect(): { variant: Variant; tag?: string } {
  const p = picked();
  if (p) return { variant: p };
  try {
    // Required lazily so plain Node (the tests) falls back to Portuguese.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    return resolve(getLocales());
  } catch {
    return { variant: 'pt-PT' };
  }
}

const detected = detect();

export const variant: Variant = detected.variant;
export const lang: Lang = variant === 'pt-PT' || variant === 'pt-BR' ? 'pt' : variant;

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
export function localeFormat(v: Variant, tag?: string): LocaleFormat {
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

export const FORMAT: LocaleFormat = localeFormat(variant, detected.tag);
export const { locale, decimalComma, currencyAfter } = FORMAT;

const TABLE: Record<Variant, Record<string, string> | null> = { 'pt-PT': null, 'pt-BR': ptBR, en, es };

/** The text for one language, with each language's fallback. Exported for the tests. */
export function translate(v: Variant, pt: string): string {
  if (v === 'pt-PT') return pt;
  if (v === 'pt-BR') return ptBR[pt] ?? pt;
  if (v === 'es') return es[pt] ?? en[pt] ?? pt;
  return TABLE[v]?.[pt] ?? pt;
}

export function t(pt: string, vars?: Record<string, string | number>): string {
  const s = translate(variant, pt);
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
