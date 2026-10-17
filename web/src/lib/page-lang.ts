// The html lang of a page whose language comes from its route or ?lang= rather than the
// browser (the help center, /support, /delete-account). proxy.ts passes it to the root layout.

const BY_PREFIX: [RegExp, string][] = [
  [/^\/pt-br\/ajuda(\/|$)/, 'pt-BR'],
  [/^\/es\/ayuda(\/|$)/, 'es'],
  [/^\/ajuda(\/|$)/, 'pt-PT'],
  [/^\/help(\/|$)/, 'en'],
];

/** pt-PT, pt-BR, es or en; null when the page follows the browser's language. */
export function pageLang(pathname: string, lang: string | null): string | null {
  for (const [re, tag] of BY_PREFIX) if (re.test(pathname)) return tag;
  const t = (lang ?? '').trim().toLowerCase().replace('_', '-');
  if (t === 'br' || t.startsWith('pt-br')) return 'pt-BR';
  if (t.startsWith('pt')) return 'pt-PT';
  if (t.startsWith('es')) return 'es';
  if (t.startsWith('en')) return 'en';
  return null;
}

export const PAGE_LANG_HEADER = 'x-page-lang';

/** The header's value only when it is one of ours (other routes don't strip a client-sent one). */
export function pageLangFrom(header: string | null): string | null {
  return header && ['pt-PT', 'pt-BR', 'es', 'en'].includes(header) ? header : null;
}
