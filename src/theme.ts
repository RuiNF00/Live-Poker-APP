// Brand + design tokens: Sweatbook, "Noite" direction (dark, felt-green night
// with the orange of the sweat as the only strong colour). Everything visual
// reads from here.

import { t } from './i18n';

export const BRAND = {
  name: 'Sweatbook',
  tagline: t('O teu caderno de póquer live'),
  webUrl: (process.env.EXPO_PUBLIC_WEB_URL as string | undefined) ?? 'https://sweatbook.poker',
  scheme: 'sweatbook',
  supportEmail: 'support@sweatbook.poker',
};

export const C = {
  // Surfaces, darkest to lightest. Cards are told apart by a hairline and a
  // soft shadow, not by heavy borders (the same idea as the stats replayer).
  bg: '#0C1311',
  bgDeep: '#080E0C',
  surface: '#141D1A',
  surface2: '#1A2521',
  surface3: '#223029',
  border: 'rgba(238,242,239,0.08)',
  borderStrong: 'rgba(238,242,239,0.16)',
  hairline: 'rgba(238,242,239,0.06)',
  // Text: primary, secondary, tertiary.
  text: '#F1F4F2',
  textDim: '#B4BFBA',
  muted: '#8C9A94', // 4.7:1 on surface3, AA for small text
  // The one strong colour: only where there is something to do.
  accent: '#FF6A3D',
  accentPressed: '#E85A30',
  accentInk: '#1A0A04',
  accentSoft: 'rgba(255,106,61,0.14)',
  accentLine: 'rgba(255,106,61,0.40)',
  good: '#4ADE80',
  goodSoft: 'rgba(74,222,128,0.12)',
  bad: '#FF8A7A',
  badSoft: 'rgba(255,138,122,0.12)',
  danger: '#FF7A6B',
  dangerSoft: 'rgba(255,122,107,0.14)',
  warn: '#F5B83D',
  warnSoft: 'rgba(245,184,61,0.12)',
  info: '#5AA9FF',
  infoSoft: 'rgba(90,169,255,0.12)',
  overlay: 'rgba(4,8,7,0.72)',
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

/** One colour per seat position, so a position reads at a glance anywhere. */
export const POS: Record<string, string> = {
  BTN: '#F5B83D',
  CO: '#5AA9FF',
  HJ: '#B07CFF',
  LJ: '#7C8CFF',
  MP: '#B07CFF',
  'UTG+2': '#FF8A7A',
  'UTG+1': '#FF8A7A',
  UTG: '#FF5A5F',
  SB: '#9DB3AA',
  BB: '#9DB3AA',
};
export const posColor = (label?: string) => (label && POS[label]) || C.muted;

export const R = { xs: 6, sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
/** Spacing. `gutter` is the screen side margin on a phone. */
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 16 };

/** Soft lift for cards and sheets. */
export const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.28,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

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
