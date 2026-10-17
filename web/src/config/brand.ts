// Sweatbook, design direction "Noite" (branding/sweatbook/tokens.json). Every user-facing
// name, color and store link comes from here or from env vars on the host.
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Sweatbook',
  tagline: {
    pt: 'Regista as tuas mãos live em segundos.',
    en: 'Log your live hands in seconds.',
  },
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'https://sweatbook.poker').replace(/\/$/, ''),
  appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL || '',
  playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL || '',
  appScheme: process.env.NEXT_PUBLIC_APP_SCHEME || 'sweatbook',
  colors: {
    accent: '#FF6A3D',
    onAccent: '#1A0A04',
    felt: '#1C4A3C',
    feltDark: '#12342A',
    bg: '#0C1311',
  },
};
