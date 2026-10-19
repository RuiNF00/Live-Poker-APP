#!/usr/bin/env node
// An update reaches a build only when both have the same runtime (app.json runtimeVersion policy
// "fingerprint"). EAS builds run with their eas.json profile's env; `eas update --environment
// production` (scripts/ota-publish.mjs) runs without it. If any of that env changed the app config
// (as EXPO_PUBLIC_APP_GROUP used to), the build and the update would get different runtimes and
// every update would silently reach nobody. This computes both, for each build profile on the
// production channel and each platform, and fails if they differ.

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const eas = JSON.parse(readFileSync(root + 'eas.json', 'utf8'));
const problems = [];

/** A profile's env as an EAS build sees it: its `extends` chain, then its own, then the platform's. */
function buildEnv(name, platform, seen = new Set()) {
  const p = eas.build?.[name];
  if (!p || seen.has(name)) return {};
  seen.add(name);
  return { ...(p.extends ? buildEnv(p.extends, platform, seen) : {}), ...(p.env ?? {}), ...(p[platform]?.env ?? {}) };
}

// The switch lives in app.json now; a variable for it anywhere in eas.json is a mistake.
for (const [name, p] of Object.entries(eas.build ?? {})) {
  for (const env of [p.env, p.ios?.env, p.android?.env]) {
    if (env && 'EXPO_PUBLIC_APP_GROUP' in env) problems.push(`eas.json build.${name} sets EXPO_PUBLIC_APP_GROUP: use "extra": { "appGroup": true } in app.json`);
  }
}

// What `eas update` sees: this shell's env, without anything a build adds.
const base = { ...process.env };
for (const k of Object.keys(base)) if (k.startsWith('EAS_BUILD')) delete base[k];

async function runtime(platform, env) {
  const { stdout } = await run('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', platform], { cwd: root, env, maxBuffer: 64 << 20 });
  return JSON.parse(stdout.trim().split('\n').pop()).runtimeVersion;
}

const profiles = Object.keys(eas.build ?? {}).filter((n) => eas.build[n].channel === 'production');
const jobs = [];
for (const platform of ['ios', 'android']) {
  jobs.push(runtime(platform, base).then((r) => ({ who: `eas update (${platform})`, platform, r })));
  for (const name of profiles) {
    const env = { ...base, ...buildEnv(name, platform), EAS_BUILD: 'true', EAS_BUILD_PLATFORM: platform, EAS_BUILD_PROFILE: name };
    jobs.push(runtime(platform, env).then((r) => ({ who: `build ${name} (${platform})`, platform, r })));
  }
}
let results;
try {
  results = await Promise.all(jobs);
} catch (e) {
  console.error(`Could not compute the runtime: ${String(e.stderr || e.message).trim().split('\n').slice(-3).join(' ')}`);
  process.exit(1);
}
for (const platform of ['ios', 'android']) {
  const mine = results.filter((x) => x.platform === platform);
  const update = mine.find((x) => x.who.startsWith('eas update')).r;
  for (const x of mine) if (x.r !== update) problems.push(`${x.who} has runtime ${x.r}, but eas update publishes for ${update}: its updates would never reach that build`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`OTA runtime: builds and eas update agree (ios ${results.find((x) => x.platform === 'ios').r.slice(0, 8)}, android ${results.find((x) => x.platform === 'android').r.slice(0, 8)}).`);
