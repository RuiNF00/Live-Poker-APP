#!/usr/bin/env node
// Over-the-air updates (expo-updates + EAS Update) set up the way we ship them:
// a JS fix reaches players without a new review, never reloads the app in the
// middle of a hand, and only reaches builds with the same native code.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(root + 'package.json', 'utf8'));
const eas = JSON.parse(readFileSync(root + 'eas.json', 'utf8'));
const config = JSON.parse(execSync('npx expo config --type public --json', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const problems = [];
const notes = [];

if (!pkg.dependencies?.['expo-updates']) problems.push('expo-updates is not installed');
// Runtime = hash of the native code: an update never reaches a build it could crash.
if (config.runtimeVersion?.policy !== 'fingerprint') problems.push(`runtimeVersion must be { "policy": "fingerprint" } (is ${JSON.stringify(config.runtimeVersion)})`);
// npm scripts are not native code: editing one must not move the next update to a runtime no build has.
const fp = (await import(root + 'fingerprint.config.js').catch(() => ({ default: {} }))).default;
if (!fp.sourceSkips?.includes?.('PackageJsonScriptsAll')) problems.push('fingerprint.config.js must skip PackageJsonScriptsAll');
const u = config.updates ?? {};
// Downloaded on launch, applied on the next cold start: never a reload mid-hand.
if (u.checkAutomatically !== 'ON_LOAD') problems.push(`updates.checkAutomatically must be "ON_LOAD" (is ${JSON.stringify(u.checkAutomatically)})`);
if (u.fallbackToCacheTimeout !== 0) problems.push(`updates.fallbackToCacheTimeout must be 0 (is ${JSON.stringify(u.fallbackToCacheTimeout)})`);
if (u.enabled === false) problems.push('updates.enabled is false');

const projectId = config.extra?.eas?.projectId;
if (projectId) {
  if (u.url !== `https://u.expo.dev/${projectId}`) problems.push(`updates.url must be https://u.expo.dev/${projectId} (run: npx eas-cli@latest update:configure)`);
} else notes.push('no EAS project yet (extra.eas.projectId): after `eas init`, run `npx eas-cli@latest update:configure` to set updates.url');

for (const name of ['production', 'testflight']) {
  const p = eas.build?.[name];
  if (!p) problems.push(`eas.json has no "${name}" build profile`);
  else if (p.channel !== 'production') problems.push(`eas.json build.${name}.channel must be "production" (is ${JSON.stringify(p.channel)})`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(['Updates: runtime fingerprint (native changes get a new runtime), ON_LOAD, applied on next cold start, channel production.', ...notes.map((n) => 'Note: ' + n)].join('\n'));
