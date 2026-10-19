#!/usr/bin/env node
// Before an upload to TestFlight or the App Store: the built app must not be a
// test build (local Pro or screenshot Pro, src/billing/dev-pro.ts). Apple's
// 2.5.19 forbids features a build hides from review, and Pro without a purchase
// would be one. Looks for TEST_BUILD_MARK in the JS bundle, which Hermes keeps
// as a plain string.
//
// For an .ipa or .app it also checks the over-the-air updates (EAS Update): a
// local xcodebuild gets no channel from eas.json, and without
// EXUpdatesRequestHeaders → expo-channel-name in Expo.plist the build never
// receives an update. It prints the runtime (fingerprint) the build carries:
// an `eas update` reaches this build only if it computes the same one.
//
//   node scripts/check-store-bundle.mjs build/Sweatbook.ipa              (channel: production)
//   node scripts/check-store-bundle.mjs build/Sweatbook.ipa --channel preview
//   node scripts/check-store-bundle.mjs path/to/Sweatbook.app     (or main.jsbundle, or a web export folder)

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARK = 'sweatbook:test-build';
const args = process.argv.slice(2);
const at = args.indexOf('--channel');
const channel = at >= 0 ? args.splice(at, 2)[1] : 'production';
const target = args[0];
if (!target || !channel) {
  console.error('Usage: node scripts/check-store-bundle.mjs <app.ipa | App.app | main.jsbundle | export folder> [--channel production]');
  process.exit(2);
}

/** Every path inside an .ipa. Big apps list more than spawnSync's default 1 MiB. */
function unzipList(p) {
  const list = spawnSync('unzip', ['-Z1', p], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (list.status !== 0 || list.stdout == null) throw new Error(`can't read ${p}${list.error ? ` (${list.error.message})` : ''}`);
  return list.stdout.split('\n');
}

/** The JS bundles inside what was built: main.jsbundle in an .app or .ipa, every .js/.hbc in a folder. */
function bundles(p) {
  if (p.endsWith('.ipa')) {
    const list = unzipList(p);
    return list
      .filter((f) => /\.(jsbundle|hbc)$/.test(f))
      .map((f) => ({ name: f, data: spawnSync('unzip', ['-p', p, f], { maxBuffer: 1 << 30 }).stdout }));
  }
  if (statSync(p).isDirectory()) return readdirSync(p, { recursive: true }).filter((f) => /\.(jsbundle|hbc|js)$/.test(f)).map((f) => ({ name: f, data: readFileSync(join(p, f)) }));
  return [{ name: p, data: readFileSync(p) }];
}

const found = bundles(target);
if (!found.length) {
  console.error(`No JS bundle found in ${target}.`);
  process.exit(2);
}
const bad = found.filter((b) => b.data.includes(MARK));
if (bad.length) {
  const kinds = [...new Set(bad.flatMap((b) => b.data.toString('latin1').match(/sweatbook:test-build:(?:local-pro|screenshots)/g) ?? []))];
  console.error(`Test build (${kinds.join(', ')}) in ${bad.map((b) => b.name).join(', ')}. Rebuild without EXPO_PUBLIC_LOCAL_PRO / EXPO_PUBLIC_SCREENSHOTS before uploading.`);
  process.exit(1);
}
console.log(`${found.length} bundle(s) checked: no test flags.`);

/** A file inside the built app: Payload/X.app/<name> in an .ipa, <name> in an .app folder. Null when absent. */
function appFile(p, name) {
  if (p.endsWith('.ipa')) {
    const list = unzipList(p);
    const f = list.find((l) => new RegExp(`^Payload/[^/]+\\.app/${name.replace(/\./g, '\\.')}$`).test(l));
    return f ? spawnSync('unzip', ['-p', p, f], { maxBuffer: 1 << 26 }).stdout : null;
  }
  const f = join(p, name);
  return existsSync(f) ? readFileSync(f) : null;
}

/** Expo.plist as an object. Xcode usually writes it binary: plutil on the Mac, plistlib elsewhere. */
function readPlist(data) {
  const viaPlutil = spawnSync('plutil', ['-convert', 'json', '-o', '-', '-'], { input: data, encoding: 'utf8' });
  if (viaPlutil.status === 0) return JSON.parse(viaPlutil.stdout);
  const viaPython = spawnSync('python3', ['-c', 'import json,plistlib,sys;print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))'], { input: data, encoding: 'utf8' });
  if (viaPython.status === 0) return JSON.parse(viaPython.stdout);
  throw new Error("can't read Expo.plist (no plutil or python3)");
}

if (target.endsWith('.ipa') || target.endsWith('.app')) {
  const plist = appFile(target, 'Expo.plist');
  const problems = [];
  let runtime = '';
  if (!plist) problems.push('no Expo.plist: expo-updates is not in this build');
  else {
    const expo = readPlist(plist);
    const app = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app.json'), 'utf8')).expo;
    const got = expo.EXUpdatesRequestHeaders?.['expo-channel-name'];
    if (expo.EXUpdatesEnabled === false) problems.push('EXUpdatesEnabled is false');
    if (expo.EXUpdatesURL !== app.updates?.url) problems.push(`EXUpdatesURL is ${expo.EXUpdatesURL ?? 'missing'}, app.json has ${app.updates?.url}`);
    const fix = got
      ? `-c 'Set :EXUpdatesRequestHeaders:expo-channel-name ${channel}'`
      : `${expo.EXUpdatesRequestHeaders ? '' : "-c 'Add :EXUpdatesRequestHeaders dict' "}-c 'Add :EXUpdatesRequestHeaders:expo-channel-name string ${channel}'`;
    if (got !== channel) problems.push(`channel is ${got ?? 'missing'}, expected ${channel}. Fix it before xcodebuild: /usr/libexec/PlistBuddy ${fix} ios/Sweatbook/Supporting/Expo.plist`);
    runtime = expo.EXUpdatesRuntimeVersion ?? '';
    // Fingerprint policy: the build phase computes it and writes it next to the embedded update.
    if (runtime === 'file:fingerprint') runtime = appFile(target, 'EXUpdates.bundle/fingerprint')?.toString().trim() ?? '';
    if (!runtime) problems.push('no runtime version: no update can match this build');
  }
  if (problems.length) {
    console.error(`Over-the-air updates won't reach this build:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Updates: channel ${channel}, runtime ${runtime}. Keep this runtime: an eas update reaches this build only with the same one.`);
}
