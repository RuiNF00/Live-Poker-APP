// Brand + design tokens: Sweatbook, "Noite" direction (dark, felt-green night
// with the orange of the sweat as the only strong colour). Everything visual
// reads from here.

export const BRAND = {
  name: 'Sweatbook',
  tagline: 'O teu caderno de póquer live',
  webUrl: 'https://sweatbook.vercel.app',
  scheme: 'sweatbook',
};

export const C = {
  bg: '#0C1311',
  surface: '#16201D',
  surface2: '#1B2723',
  surface3: '#22302B',
  border: '#24302C',
  borderStrong: '#33433D',
  text: '#EEF2EF',
  textDim: '#B3BEB9',
  muted: '#8C9A94',
  accent: '#FF6A3D',
  accentInk: '#1A0A04',
  accentSoft: 'rgba(255,106,61,0.14)',
  good: '#4ADE80',
  bad: '#FF8A7A',
  danger: '#FF7A6B',
  dangerSoft: 'rgba(255,122,107,0.14)',
  warn: '#F5B83D',
  info: '#5AA9FF',
  // Table
  felt: '#1C4A3C',
  feltEdge: '#163D31',
  rail: '#0F1B17',
  railLine: 'rgba(238,242,239,0.16)',
  chip: '#F4F1EA',
  // Actions
  fold: '#5C6A64',
  check: '#9DB3AA',
  call: '#4ADE80',
  bet: '#F5B83D',
  raise: '#F5B83D',
  allin: '#FF5A5F',
  // Cards (4-colour deck reads faster at a glance)
  suit: { s: '#1B1D1C', h: '#D93A3A', d: '#2F6FE0', c: '#1F9D57' } as Record<string, string>,
};

export const R = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const F = {
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
  black: 'HankenGrotesk_800ExtraBold',
  mono: 'JetBrainsMono_700Bold',
  monoRegular: 'JetBrainsMono_500Medium',
};

/** Font family for a weight, since custom fonts ignore fontWeight on Android. */
export function ff(weight?: string | number): string {
  const w = Number(weight ?? 400);
  if (w >= 800) return F.black;
  if (w >= 700) return F.bold;
  if (w >= 600) return F.semibold;
  if (w >= 500) return F.medium;
  return F.regular;
}
