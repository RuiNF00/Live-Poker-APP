import path from 'node:path';
import type { NextConfig } from 'next';

// The shared hand format lives outside this folder (packages/hand-format), so the
// bundler root is the repository root.
const repoRoot = path.join(__dirname, '..');

// Reports must reach a person before production goes out (Apple 1.2).
if (process.env.VERCEL_ENV === 'production' && !process.env.MODERATION_WEBHOOK_URL) {
  throw new Error('MODERATION_WEBHOOK_URL em falta: as denúncias não chegam a ninguém (security/incidentes.md §3)');
}

const nextConfig: NextConfig = {
  transpilePackages: ['@livepoker/hand-format'],
  // Shared links open on casino Wi-Fi and in chat apps: the CSS (~10 KB) rides in the HTML instead of
  // costing two more round trips before the first paint.
  experimental: { inlineCss: true },
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Voice stories run ffmpeg as a child process; ship its binary with that route.
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/story-video': ['./node_modules/ffmpeg-static/ffmpeg'],
    // Brand font for the link preview images.
    '/h/[id]/og': ['./assets/fonts/*.ttf'],
    '/live/[id]/og': ['./assets/fonts/*.ttf'],
    '/swap/[id]/og': ['./assets/fonts/*.ttf'],
    '/p/[id]/og': ['./assets/fonts/*.ttf'],
    '/u/[handle]/og': ['./assets/fonts/*.ttf'],
    '/og/invite': ['./assets/fonts/*.ttf'],
    '/opengraph-image': ['./assets/fonts/*.ttf'],
  },
  // Private links (coaching, swaps, action-package agreements) carry their secret in the URL:
  // never indexed, cached or sent on as a referrer.
  async headers() {
    const secret = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ];
    return [
      { source: '/c/:token*', headers: secret },
      { source: '/api/coach/:path*', headers: secret },
      { source: '/swap/:path*', headers: secret },
      { source: '/api/swaps/:path*', headers: secret },
      { source: '/api/swap-groups/:path*', headers: secret },
      { source: '/o/:path*', headers: secret },
      { source: '/api/offers/:path*', headers: secret },
    ];
  },
  // Localised entry points for the store pages: Apple's Support URL and Google's data deletion URL.
  async redirects() {
    const to = (path: string, lang: string) => ({ destination: `${path}?lang=${lang}`, permanent: false });
    return [
      { source: '/suporte', ...to('/support', 'pt') },
      { source: '/pt-br/suporte', ...to('/support', 'pt-BR') },
      { source: '/es/soporte', ...to('/support', 'es') },
      { source: '/apagar-conta', ...to('/delete-account', 'pt') },
      { source: '/pt-br/apagar-conta', ...to('/delete-account', 'pt-BR') },
      { source: '/es/eliminar-cuenta', ...to('/delete-account', 'es') },
      // The old static copies (privacy.html and terms.html still link to them) are gone.
      { source: '/delete-account.html', destination: '/delete-account', permanent: false },
      { source: '/support.html', destination: '/support', permanent: false },
    ];
  },
  // Store legal pages (generated from store/web by the store-release work) live in public/.
  // /support and /delete-account are pages of their own (src/app), in the four help languages.
  async rewrites() {
    return ['privacy', 'terms'].map((p) => ({ source: `/${p}`, destination: `/${p}.html` }));
  },
};

export default nextConfig;
