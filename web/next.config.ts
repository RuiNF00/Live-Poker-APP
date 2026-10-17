import path from 'node:path';
import type { NextConfig } from 'next';

// The shared hand format lives outside this folder (packages/hand-format), so the
// bundler root is the repository root.
const repoRoot = path.join(__dirname, '..');

const nextConfig: NextConfig = {
  transpilePackages: ['@livepoker/hand-format'],
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Voice stories run ffmpeg as a child process; ship its binary with that route.
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/story-video': ['./node_modules/ffmpeg-static/ffmpeg'],
    // Brand font for the link preview images.
    '/h/[id]/og': ['./assets/fonts/*.ttf'],
    '/live/[id]/og': ['./assets/fonts/*.ttf'],
    '/u/[handle]/og': ['./assets/fonts/*.ttf'],
    '/og/invite': ['./assets/fonts/*.ttf'],
    '/opengraph-image': ['./assets/fonts/*.ttf'],
  },
  // Coaching links carry their secret in the URL: never indexed, cached or sent on as a referrer.
  async headers() {
    const secret = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ];
    return [
      { source: '/c/:token*', headers: secret },
      { source: '/api/coach/:path*', headers: secret },
    ];
  },
  // Store legal pages (generated from store/web by the store-release work) live in public/.
  // /support is a page of its own (src/app/support), opened by the app with topic, version and OS.
  async rewrites() {
    return ['privacy', 'terms', 'delete-account'].map((p) => ({ source: `/${p}`, destination: `/${p}.html` }));
  },
};

export default nextConfig;
