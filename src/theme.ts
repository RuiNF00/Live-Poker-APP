// Brand + design tokens. The brand is a placeholder until Rui picks one of the
// name/design proposals: everything visual reads from here, so a rebrand is
// this file plus the icon assets.

export const BRAND = {
  name: 'Riverlog',
  tagline: 'O teu diário de póquer live',
  webUrl: 'https://riverlog.vercel.app',
  scheme: 'riverlog',
};

export const C = {
  bg: '#0A0C0B',
  surface: '#121614',
  surface2: '#1A1F1C',
  surface3: '#232925',
  border: '#2A312D',
  borderStrong: '#3A433E',
  text: '#F1F4F2',
  textDim: '#A4ADA7',
  muted: '#6C766F',
  accent: '#3DDC97',
  accentInk: '#04140D',
  accentSoft: 'rgba(61,220,151,0.14)',
  danger: '#F2645F',
  dangerSoft: 'rgba(242,100,95,0.14)',
  warn: '#F5B83D',
  info: '#5AA9FF',
  // Table
  felt: '#0F2A20',
  feltEdge: '#0A1D16',
  rail: '#070908',
  railLine: 'rgba(61,220,151,0.28)',
  chip: '#E9E4D4',
  // Actions
  fold: '#5C6460',
  check: '#7FB8A0',
  call: '#3DDC97',
  bet: '#F5B83D',
  raise: '#F5B83D',
  allin: '#F2645F',
  // Cards (4-colour deck reads faster at a glance)
  suit: { s: '#1B1D1C', h: '#D93A3A', d: '#2F6FE0', c: '#1F9D57' } as Record<string, string>,
};

export const R = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const F = {
  mono: 'Menlo',
};
