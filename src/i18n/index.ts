// Portuguese is the source language: every string in the app is written in
// pt-PT and that text is its own key. The other languages are tables keyed by
// that text: en.ts and es.ts translate every string, pt-BR.ts holds only the
// strings that read differently in Brazil. A missing entry falls back to the
// closest language (pt-BR to pt-PT, es to English, English to pt-PT);
// src/i18n/__tests__ and scripts/i18n-missing.ts list what is missing.

import { localeFormat, type LocaleFormat } from '../../packages/hand-format/src/money';


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

// Number and money rules are shared with the web pages (packages/hand-format/src/money.ts).
export { localeFormat, type LocaleFormat };

export const FORMAT: LocaleFormat = localeFormat(variant, detected.tag);
export const { locale, decimalComma, currencyAfter } = FORMAT;

type Table = Record<string, string>;
const TABLES: Partial<Record<Variant, Table>> = {};

// Only the tables a language needs are evaluated: ~0.5 MB of strings stays
// untouched at launch. Metro still bundles them; they just never run.
/* eslint-disable @typescript-eslint/no-require-imports */
function table(v: 'pt-BR' | 'en' | 'es'): Table {
  return (TABLES[v] ??=
    v === 'pt-BR' ? require('./pt-BR').default : v === 'es' ? require('./es').default : require('./en').default);
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** The text for one language, with each language's fallback. Exported for the tests. */
export function translate(v: Variant, pt: string): string {
  if (v === 'pt-PT') return pt;
  if (v === 'pt-BR') return table('pt-BR')[pt] ?? pt;
  if (v === 'es') return table('es')[pt] ?? table('en')[pt] ?? pt;
  return table('en')[pt] ?? pt;
}

export function t(pt: string, vars?: Record<string, string | number>): string {
  const s = translate(variant, pt);
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
