// Web: each language's table is its own file, fetched before the app starts
// (index.web.js waits for loadTables), so a visitor downloads only the strings
// of their language instead of all three (~0.5 MB).

import type { Variant } from './index';

export type Table = Record<string, string>;
const TABLES: Partial<Record<'pt-BR' | 'en' | 'es', Table>> = {};

/** Loaded tables only; until then (or if a file failed) the Portuguese shows. */
export function getTable(v: 'pt-BR' | 'en' | 'es'): Table {
  return TABLES[v] ?? {};
}

const load = {
  'pt-BR': () => import('./pt-BR'),
  en: () => import('./en'),
  es: () => import('./es'),
};

const fetchTable = (k: 'pt-BR' | 'en' | 'es') =>
  load[k]()
    .then((m) => void (TABLES[k] = m.default))
    .catch(() => {});

/**
 * The table `v` needs before the app starts. Never rejects. Spanish translates every
 * string (i18n:missing), so its English fallback loads after the start instead of before.
 */
export async function loadTables(v: Variant): Promise<void> {
  if (v === 'pt-PT') return;
  await fetchTable(v);
  if (v === 'es') void fetchTable('en');
}
