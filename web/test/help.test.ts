import { describe, expect, it } from 'vitest';
import { helpLocale } from '../src/components/help/copy';
import { BR } from '../src/lib/help/articles-br';
import { ES } from '../src/lib/help/articles-es';
import { articles, findArticle, HELP_LOCALES, LIVE_FEATURES, textOf } from '../src/lib/help/articles';

describe('help center', () => {
  it('has every article in Spanish and Brazilian Portuguese, with or without the gated ones', () => {
    for (const live of [false, true]) {
      LIVE_FEATURES.swaps = live;
      LIVE_FEATURES.lifetime = live;
      for (const a of articles()) {
        expect(ES[a.id], `es ${a.id}`).toBeDefined();
        expect(BR[a.id], `br ${a.id}`).toBeDefined();
      }
    }
    LIVE_FEATURES.swaps = true;
    LIVE_FEATURES.lifetime = true;
  });

  it('gives each article a unique slug per language, found back by that slug', () => {
    for (const l of HELP_LOCALES) {
      const slugs = articles().map((a) => textOf(a, l).slug);
      expect(new Set(slugs).size, l).toBe(slugs.length);
      for (const a of articles()) expect(findArticle(l, textOf(a, l).slug)?.id).toBe(a.id);
    }
  });

  it('shows one lifetime article: "no" while the cancel-flow offer is off', () => {
    LIVE_FEATURES.lifetime = false;
    expect(articles().filter((a) => a.id.includes('lifetime')).map((a) => a.id)).toEqual(['no-lifetime']);
    LIVE_FEATURES.lifetime = true;
    expect(articles().filter((a) => a.id.includes('lifetime')).map((a) => a.id)).toEqual(['lifetime']);
  });

  it('maps app and browser language codes to a help language', () => {
    expect(helpLocale('pt-BR')).toBe('br');
    expect(helpLocale('pt_br')).toBe('br');
    expect(helpLocale('pt')).toBe('pt');
    expect(helpLocale('pt-PT')).toBe('pt');
    expect(helpLocale('es-MX')).toBe('es');
    expect(helpLocale('en-GB')).toBe('en');
    expect(helpLocale('de')).toBeNull();
  });
});

describe('store pages', () => {
  it('sends the localised support and deletion addresses to the right language', async () => {
    const { default: config } = await import('../next.config');
    const redirects = await config.redirects!();
    const to = Object.fromEntries(redirects.map((r) => [r.source, r.destination]));
    expect(to['/suporte']).toBe('/support?lang=pt');
    expect(to['/pt-br/suporte']).toBe('/support?lang=pt-BR');
    expect(to['/es/soporte']).toBe('/support?lang=es');
    expect(to['/apagar-conta']).toBe('/delete-account?lang=pt');
    expect(to['/pt-br/apagar-conta']).toBe('/delete-account?lang=pt-BR');
    expect(to['/es/eliminar-cuenta']).toBe('/delete-account?lang=es');
    expect(redirects.every((r) => !r.permanent)).toBe(true);
  });
});

describe('web text in four languages', () => {
  /** Every key path of a copy object, so a string missing in one language shows up. */
  const shape = (o: unknown, at = ''): string[] =>
    o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => shape(v, `${at}.${k}`)) : [`${at}:${Array.isArray(o) ? `[${o.length}]` : typeof o}`];

  it('has the same text, key for key, in pt, pt-BR, es and en', async () => {
    const { helpCopy } = await import('../src/components/help/copy');
    const { SUPPORT_COPY } = await import('../src/components/help/support-copy');
    const { DELETE_COPY } = await import('../src/components/help/delete-copy');
    for (const [name, copy] of Object.entries({ helpCopy, SUPPORT_COPY, DELETE_COPY })) {
      expect(Object.keys(copy).sort(), name).toEqual([...HELP_LOCALES].sort());
      const pt = shape(copy.pt);
      for (const l of HELP_LOCALES) expect(shape(copy[l]), `${name}.${l}`).toEqual(pt);
    }
  });
});

describe('html lang of language-specific pages', () => {
  it('comes from the route, then from ?lang=, else the browser decides', async () => {
    const { pageLang } = await import('../src/lib/page-lang');
    expect(pageLang('/es/ayuda', null)).toBe('es');
    expect(pageLang('/help/cancel-pro', 'pt')).toBe('en');
    expect(pageLang('/pt-br/ajuda/x', null)).toBe('pt-BR');
    expect(pageLang('/press', 'pt')).toBe('en');
    expect(pageLang('/ajuda', null)).toBe('pt-PT');
    expect(pageLang('/support', 'pt-BR')).toBe('pt-BR');
    expect(pageLang('/delete-account', 'es')).toBe('es');
    expect(pageLang('/support', null)).toBeNull();
  });
});
