#!/usr/bin/env node
// npm run ota:publish: checks, then the EAS Update, then its source maps to
// Sentry so a crash in this update points at our own line. Once Sentry is set
// up (eas.json no longer has SENTRY_DISABLE_AUTO_UPLOAD "true"), it refuses to
// publish without the token: an update whose crashes can't be read is not shipped.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const eas = JSON.parse(readFileSync(root + 'eas.json', 'utf8'));
const sentry = { ...(eas.build?.base?.env ?? {}), ...(eas.build?.production?.env ?? {}) }.SENTRY_DISABLE_AUTO_UPLOAD !== 'true';
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

if (sentry && !(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)) {
  console.error('Sentry is on for production builds: set SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT (from Projetos-Claude/sweatbook-chaves) so this update\'s source maps go up too.');
  process.exit(1);
}
run('node scripts/pre-release.mjs --quick');
run('npx eas-cli@latest update --channel production --environment production');
if (sentry) run('npx sentry-expo-upload-sourcemaps dist');
