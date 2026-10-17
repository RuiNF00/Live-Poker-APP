// Placeholder brand. Every user-facing name, color and store link comes from here,
// so swapping in the final brand is a one-file change (or env vars on the host).
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'LiveHand',
  tagline: {
    pt: 'Regista as tuas mãos live em segundos.',
    en: 'Log your live hands in seconds.',
  },
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL || '',
  playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL || '',
  appScheme: process.env.NEXT_PUBLIC_APP_SCHEME || 'livepoker',
  colors: {
    accent: '#f5b83d',
    felt: '#0f5c45',
    feltDark: '#0a3d2e',
    bg: '#0b0f14',
  },
};
