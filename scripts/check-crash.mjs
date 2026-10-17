#!/usr/bin/env node
// Crash reports (Sentry) wired the way we ship them: the SDK and its config
// plugin are in, Metro writes the debug ids that tie a report to our source,
// and every store build either uploads source maps or says plainly that
// Sentry isn't set up yet. One switch decides both, in eas.json:
// SENTRY_DISABLE_AUTO_UPLOAD "true" until Rui's Sentry account and token exist.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(root + 'package.json', 'utf8'));
const eas = JSON.parse(readFileSync(root + 'eas.json', 'utf8'));
const config = JSON.parse(execSync('npx expo config --type public --json', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const problems = [];

if (!pkg.dependencies?.['@sentry/react-native']) problems.push('@sentry/react-native is not installed');
const plugins = (config.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
if (!plugins.includes('@sentry/react-native')) problems.push('app.json plugins must include "@sentry/react-native"');
let metro = '';
try {
  metro = readFileSync(root + 'metro.config.js', 'utf8');
} catch {
  // missing: reported below
}
if (!metro.includes('getSentryExpoConfig')) problems.push('metro.config.js must use getSentryExpoConfig (source map debug ids)');

/** A build profile's env with what it extends folded in. */
function envOf(name, seen = new Set()) {
  const p = eas.build?.[name];
  if (!p || seen.has(name)) return {};
  seen.add(name);
  return { ...(p.extends ? envOf(p.extends, seen) : {}), ...(p.env ?? {}) };
}
const off = ['production', 'testflight'].map((n) => envOf(n).SENTRY_DISABLE_AUTO_UPLOAD === 'true');
if (off[0] !== off[1]) problems.push('eas.json production and testflight must agree on SENTRY_DISABLE_AUTO_UPLOAD');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  off[0]
    ? 'Crash reports: wired, Sentry not set up yet (SENTRY_DISABLE_AUTO_UPLOAD=true; without EXPO_PUBLIC_SENTRY_DSN the app sends nothing).'
    : 'Crash reports: source maps upload on every build and every ota:publish (needs SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT).',
);
