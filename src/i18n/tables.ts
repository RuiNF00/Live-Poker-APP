// Phones: a language's table is evaluated the first time it is asked for, so
// only the active language's strings ever run (Metro still bundles all three).
// The web loads them as separate files instead: see tables.web.ts.

export type Table = Record<string, string>;
const TABLES: Partial<Record<'pt-BR' | 'en' | 'es', Table>> = {};

/* eslint-disable @typescript-eslint/no-require-imports */
export function getTable(v: 'pt-BR' | 'en' | 'es'): Table {
  return (TABLES[v] ??= v === 'pt-BR' ? require('./pt-BR').default : v === 'es' ? require('./es').default : require('./en').default);
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** Nothing to wait for on phones. */
export async function loadTables(_v?: string): Promise<void> {}
