#!/usr/bin/env node
// Before an upload to TestFlight or the App Store: the built app must not be a
// test build (local Pro or screenshot Pro, src/billing/dev-pro.ts). Apple's
// 2.5.19 forbids features a build hides from review, and Pro without a purchase
// would be one. Looks for TEST_BUILD_MARK in the JS bundle, which Hermes keeps
// as a plain string.
//
//   node scripts/check-store-bundle.mjs build/Sweatbook.ipa
//   node scripts/check-store-bundle.mjs path/to/Sweatbook.app     (or main.jsbundle, or a web export folder)

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARK = 'sweatbook:test-build';
const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/check-store-bundle.mjs <app.ipa | App.app | main.jsbundle | export folder>');
  process.exit(2);
}

/** The JS bundles inside what was built: main.jsbundle in an .app or .ipa, every .js/.hbc in a folder. */
function bundles(p) {
  if (p.endsWith('.ipa')) {
    const list = spawnSync('unzip', ['-Z1', p], { encoding: 'utf8' });
    if (list.status !== 0) throw new Error(`can't read ${p}`);
    return list.stdout
      .split('\n')
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
  const kinds = [...new Set(bad.flatMap((b) => b.data.toString('latin1').match(/sweatbook:test-build:[a-z-]+/g) ?? []))];
  console.error(`Test build (${kinds.join(', ')}) in ${bad.map((b) => b.name).join(', ')}. Rebuild without EXPO_PUBLIC_LOCAL_PRO / EXPO_PUBLIC_SCREENSHOTS before uploading.`);
  process.exit(1);
}
console.log(`${found.length} bundle(s) checked: no test flags.`);
