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

export const DARK = {
  // Surfaces, darkest to lightest. Cards are told apart by a hairline and a
  // soft shadow, not by heavy borders (the same idea as the stats replayer).
  bg: '#0C1311',
  bgDeep: '#080E0C',
  surface: '#141D1A',
  surface2: '#1A2521',
  surface3: '#223029',
  border: 'rgba(238,242,239,0.08)',
  borderStrong: 'rgba(238,242,239,0.16)',
  // Outline of things you type in or switch: 3.08:1 on bg, 3.37:1 inside a card.
  fieldBorder: 'rgba(238,242,239,0.40)',
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
  // A switch that is off: the white knob has to stand out from it.
  switchOff: '#5E6C66', // 3:1 on surface (the off track was 1.25:1)
  // Replayer panels (narration, timeline, decision), warmer than the app's greens.
  rpPanel: '#0E0D0B',
  rpPanel2: '#141210',
  rpLine: '#2A2620',
  rpDot: '#7A7260',
  rpMuted: '#B0A892',
  // Table
  felt: '#1C4A3C',
  feltEdge: '#163D31',
  rail: '#0F1B17',
  railLine: 'rgba(238,242,239,0.16)',
  chip: '#F4F1EA',
  // Actions
  // Light enough to read on the felt (4.5:1); folded seats still read as out.
  fold: '#8FA19A',
  check: '#9DB3AA',
  call: '#4ADE80',
  bet: '#F5B83D',
  raise: '#F5B83D',
  allin: '#FF5A5F',
  // Cards (4-colour deck reads faster at a glance)
  // Dark enough for small pips on ivory (4.5:1 or better).
  // Ink on the cream card faces, the same on the table and in the card picker: 4.5:1 or more on the cream.
  suit: { s: '#1B1D1C', h: '#B91C1C', d: '#1D4ED8', c: '#16794A' } as Record<string, string>,
};

export type Palette = typeof DARK;
type Scheme = 'dark' | 'light';

/**
 * "Dia": the same app on paper instead of felt, for bright rooms and daylight.
 * Every text colour is AA (4.5:1) on bg, surface and surface3, and the outlines
 * of controls are 3:1; src/__tests__/theme-contrast.test.ts checks it.
 * The orange is darker here: #FF6A3D on white is 2.9:1, too faint for text.
 * The table, the cards and the images to share stay as they are in both.
 */
export const LIGHT: Palette = {
  ...DARK,
  bg: '#F5F3EE',
  bgDeep: '#ECE9E2',
  surface: '#FFFFFF',
  surface2: '#F8F6F2',
  surface3: '#ECE8E0',
  border: 'rgba(16,24,21,0.10)',
  borderStrong: 'rgba(16,24,21,0.18)',
  fieldBorder: 'rgba(16,24,21,0.50)',
  hairline: 'rgba(16,24,21,0.07)',
  text: '#121A17',
  textDim: '#3E4944',
  muted: '#58645F',
  accent: '#A63609',
  accentPressed: '#8A2E08',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(166,54,9,0.08)',
  accentLine: 'rgba(166,54,9,0.45)',
  good: '#126B33',
  goodSoft: 'rgba(18,107,51,0.09)',
  bad: '#B42318',
  badSoft: 'rgba(180,35,24,0.08)',
  danger: '#B42318',
  dangerSoft: 'rgba(180,35,24,0.10)',
  warn: '#7F4806',
  warnSoft: 'rgba(161,92,7,0.12)',
  info: '#184FAE',
  infoSoft: 'rgba(29,95,208,0.10)',
  overlay: 'rgba(20,24,22,0.40)',
  switchOff: '#B9B2A3',
  rpPanel: '#FFFFFF',
  rpPanel2: '#FBF9F5',
  rpLine: '#DDD7CB',
  rpDot: '#A39A86',
  rpMuted: '#6B6352',
};

/** The colours in use. Filled once at start-up (applyScheme) and read everywhere. */
export const C: Palette = { ...DARK, suit: { ...DARK.suit } };


/** One colour per seat position, so a position reads at a glance anywhere. */
const POS_DARK: Record<string, string> = {
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
// The same hues dark enough for a pill on paper (4.5:1 on the light surfaces).
export const POS_LIGHT: Record<string, string> = {
  BTN: '#7A4F00',
  CO: '#184FAE',
  HJ: '#6838B8',
  LJ: '#3A44B0',
  MP: '#6838B8',
  'UTG+2': '#9A2D18',
  'UTG+1': '#9A2D18',
  UTG: '#A21F14',
  SB: '#425C52',
  BB: '#425C52',
};
export const POS: Record<string, string> = { ...POS_DARK };
/** Avatar colours (initials over a 15% tint of the same hue). The light set is dark enough to read on paper. */
export const AVATAR_HUES = ['#FF6A3D', '#5AA9FF', '#B07CFF', '#4ADE80', '#F5B83D', '#FF8A7A', '#3DD6C6'];
export const AVATAR_HUES_LIGHT = ['#9A3208', '#1A54B8', '#6E3BC2', '#116A32', '#7A4F00', '#B42318', '#0B635C'];
export const posColor = (label?: string) => (label && POS[label]) || C.muted;
/** On the felt (always dark), whatever the app's scheme. */
export const posColorDark = (label?: string) => (label && POS_DARK[label]) || DARK.muted;

let scheme: Scheme = 'dark';
export const currentScheme = () => scheme;

/** Switches every token in place. Only before the first module reads a colour (lib/appearance). */
export function applyScheme(next: Scheme) {
  if (next === scheme) return;
  scheme = next;
  Object.assign(C, next === 'light' ? LIGHT : DARK);
  Object.assign(POS, next === 'light' ? POS_LIGHT : POS_DARK);
  // On paper a 28% shadow reads as dirt.
  Object.assign(SHADOW, { shadowOpacity: next === 'light' ? 0.1 : 0.28 });
}

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
