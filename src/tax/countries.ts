// Countries where live players play, most played first. Names are the PT
// strings (English in en.ts); the flag is built from the ISO code.

import { t } from '@/i18n';
import type { Session } from '@/store/types';

export const COUNTRIES: [code: string, name: string][] = [
  ['US', 'Estados Unidos'],
  ['PT', 'Portugal'],
  ['ES', 'Espanha'],
  ['GB', 'Reino Unido'],
  ['FR', 'França'],
  ['MC', 'Mónaco'],
  ['CZ', 'Chéquia'],
  ['CY', 'Chipre'],
  ['MT', 'Malta'],
  ['AT', 'Áustria'],
  ['DE', 'Alemanha'],
  ['IE', 'Irlanda'],
  ['IT', 'Itália'],
  ['NL', 'Países Baixos'],
  ['BE', 'Bélgica'],
  ['CH', 'Suíça'],
  ['SI', 'Eslovénia'],
  ['BS', 'Bahamas'],
  ['MX', 'México'],
  ['CA', 'Canadá'],
  ['BR', 'Brasil'],
  ['UY', 'Uruguai'],
  ['AU', 'Austrália'],
  ['MO', 'Macau'],
  ['KR', 'Coreia do Sul'],
  ['VN', 'Vietname'],
  ['PH', 'Filipinas'],
  ['AE', 'Emirados Árabes Unidos'],
];

export function flag(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';
}

export function countryName(code: string | undefined): string {
  if (!code) return t('Sem país');
  const c = COUNTRIES.find(([k]) => k === code);
  return c ? t(c[1]) : code;
}

/** The country this venue was last played in, so a venue fills it in by itself. */
export function countryOfVenue(venue: string, sessions: Session[]): string | undefined {
  const v = venue.trim().toLowerCase();
  if (!v) return undefined;
  let best: Session | undefined;
  for (const s of sessions) if (s.country && s.venue.trim().toLowerCase() === v && (!best || s.startedAt > best.startedAt)) best = s;
  return best?.country;
}

/** Countries you have played in, most recent first, then the rest of the list. */
export function countryOrder(sessions: Session[]): string[] {
  const seen = new Map<string, number>();
  for (const s of sessions) if (s.country) seen.set(s.country, Math.max(seen.get(s.country) ?? 0, s.startedAt));
  const used = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return [...used, ...COUNTRIES.map(([k]) => k).filter((k) => !seen.has(k))];
}
