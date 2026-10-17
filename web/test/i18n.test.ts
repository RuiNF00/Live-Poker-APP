import { describe, expect, it } from 'vitest';
import { intlTag, isPt, LOCALES, numberTag, pickLocale, t, withCurrency, type Locale } from '../src/lib/i18n';
import { backingCopy } from '../src/components/backing/copy';
import { coachCopy } from '../src/components/coach/copy';
import { landingCopy } from '../src/components/landing/copy';
import { liveCopy } from '../src/components/live/copy';
import { offerCopy } from '../src/components/offer/copy';
import { profileCopy } from '../src/components/profile/copy';
import { swapCopy } from '../src/components/swap/copy';
import { describeStep, formatChips, streetLabel } from '../src/lib/hand-i18n';

describe('pickLocale', () => {
  it.each([
    ['pt-BR,pt;q=0.9,en;q=0.8', 'pt-BR'],
    ['pt-br', 'pt-BR'],
    ['pt-PT,pt;q=0.9', 'pt'],
    ['pt', 'pt'],
    ['pt-AO', 'pt'],
    ['es-MX,es;q=0.9,en;q=0.8', 'es'],
    ['es', 'es'],
    ['es-419', 'es'],
    ['en-US,en;q=0.9', 'en'],
    ['en-GB', 'en'],
    // First supported language in the visitor's order wins.
    ['fr-FR,es;q=0.8,en;q=0.5', 'es'],
    ['de-DE,en;q=0.9,pt;q=0.8', 'en'],
    ['en;q=0.5,pt-BR;q=0.9', 'pt-BR'],
    ['pt;q=0,es', 'es'],
    // Nothing supported: English.
    ['fr-FR,fr;q=0.9', 'en'],
    // No header (link-preview bots): the site's own language.
    ['', 'pt'],
    [null, 'pt'],
    [undefined, 'pt'],
    ['*', 'en'],
    // Not Portuguese or Spanish, despite the letters.
    ['ptx, esperanto', 'en'],
  ] as const)('%s -> %s', (header, want) => {
    expect(pickLocale(header)).toBe(want);
  });
});

describe('locale helpers', () => {
  it('maps locales to Intl tags', () => {
    expect(LOCALES.map(intlTag)).toEqual(['pt-PT', 'pt-BR', 'en-GB', 'es']);
    expect(LOCALES.map(numberTag)).toEqual(['de-DE', 'pt-BR', 'en-GB', 'es']);
    expect(LOCALES.filter(isPt)).toEqual(['pt', 'pt-BR']);
  });
  it('places the currency per locale', () => {
    expect(withCurrency('1.500', '€', 'pt')).toBe('1.500€');
    expect(withCurrency('1.500', '$', 'pt-BR', '−')).toBe('−$1.500');
    expect(withCurrency('1,500', '$', 'en')).toBe('$1,500');
    expect(withCurrency('1.500', '€', 'es')).toBe('1.500€');
  });
});

/** Every key, deeply, with functions and arrays reduced to their shape. */
function shape(v: unknown): unknown {
  if (typeof v === 'function') return `fn${v.length}`;
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, shape(x)]));
  return typeof v;
}

/** All the text of a copy object, functions called with sample arguments. */
function text(v: unknown): string {
  if (typeof v === 'function') return String((v as (...x: unknown[]) => unknown)('Ana', 'Rui', 'X', 'Y'));
  if (Array.isArray(v)) return v.map(text).join(' ');
  if (v && typeof v === 'object') return Object.values(v).map(text).join(' ');
  return String(v);
}

const copies: [string, (l: Locale) => unknown][] = [
  ['hand page', t],
  ['backing', backingCopy],
  ['coach', coachCopy],
  ['landing', landingCopy],
  ['live', liveCopy],
  ['offer', offerCopy],
  ['profile', profileCopy],
  ['swap', swapCopy],
];

describe.each(copies)('%s copy', (_name, copy) => {
  it('has the same keys in every locale', () => {
    const want = shape(copy('pt'));
    for (const l of LOCALES) expect(shape(copy(l))).toEqual(want);
  });
  it('is really translated', () => {
    expect(text(copy('pt-BR'))).not.toEqual(text(copy('pt')));
    expect(text(copy('es'))).not.toEqual(text(copy('pt')));
  });
  it('keeps to the store policy and the local vocabulary', () => {
    const br = text(copy('pt-BR'));
    const es = text(copy('es'));
    // No wagering words, no selling words for staking.
    expect(br).not.toMatch(/apost|comprar|investir|\bretorno\b/i);
    expect(es).not.toMatch(/apuest|apost|comprar|invertir|\bretorno\b/i);
    // pt-PT words and "tu" forms that must not leak into pt-BR.
    expect(br).not.toMatch(/\b(partilh\w*|telemóvel|ecrã|registo|registar|descarregar|teu|tua|tens|podes|queres|estás|prémio\w*)\b/i);
    expect(br).not.toMatch(/\ba (enviar|guardar|confirmar|decorrer|carregar)\b/i);
    // Neutral Spanish: no vosotros, no usted, no móvil/celular.
    expect(es).not.toMatch(/\b(vosotros|usted|móvil|celular|tenéis|podéis)\b/i);
  });
});

describe('hand text', () => {
  it('formats chips per locale', () => {
    expect(formatChips(1500, 'en')).toBe('1,500');
    expect(formatChips(9500, 'pt-BR')).toBe('9.500');
    expect(formatChips(25_000, 'es')).toBe('25k');
  });
  it('names streets and steps in Spanish', () => {
    expect(streetLabel('preflop', 'es')).toBe('Preflop');
    expect(describeStep({ kind: 'start' } as Parameters<typeof describeStep>[0], 2, 'chips', 'es')).toBe('Inicio de la mano');
  });
});
