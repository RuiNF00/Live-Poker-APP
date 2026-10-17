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
