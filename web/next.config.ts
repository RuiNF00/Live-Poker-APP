import path from 'node:path';
import type { NextConfig } from 'next';

// The shared hand format lives outside this folder (packages/hand-format), so the
// bundler root is the repository root.
const repoRoot = path.join(__dirname, '..');

const nextConfig: NextConfig = {
  transpilePackages: ['@livepoker/hand-format'],
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Store legal pages (generated from store/web by the store-release work) live in public/.
  async rewrites() {
    return ['privacy', 'terms', 'support', 'delete-account'].map((p) => ({ source: `/${p}`, destination: `/${p}.html` }));
  },
};

export default nextConfig;
