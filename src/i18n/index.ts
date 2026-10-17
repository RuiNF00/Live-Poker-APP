// Portuguese is the source language: every string in the app is written in
// pt-PT and that text is its own key. Devices in any other language get the
// English from en.ts; a missing entry falls back to the Portuguese.

import en from './en';

export type Lang = 'pt' | 'en';

function detect(): Lang {
  try {
    // Required lazily so plain Node (the tests) falls back to Portuguese.
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    const code = getLocales()[0]?.languageCode;
    return !code || code === 'pt' ? 'pt' : 'en';
  } catch {
    return 'pt';
  }
}

export const lang: Lang = detect();

/** BCP 47 tag for dates and numbers. */
export const locale = lang === 'pt' ? 'pt-PT' : 'en-GB';

export function t(pt: string, vars?: Record<string, string | number>): string {
  const s = lang === 'en' ? (en[pt] ?? pt) : pt;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
