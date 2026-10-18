#!/usr/bin/env node
// Bundle size budget, run on the web export by check:release. What every
// launch downloads and evaluates (entry + shared chunks) must stay under the
// budget, so a heavy new dependency shows up here and not as a slow start.
//
//   node scripts/check-bundle.mjs <export dir>

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bytes, minified. 17 Oct 2026: entry 1.12 MB + __common 1.04 MB at launch;
 * the en/es/pt-BR tables (0.13-0.21 MB each) load as their own files, only the
 * visitor's language (index.web.js). RevenueCat web 1.15 MB sits in its own
 * chunk, loaded when billing starts. 18 Oct: 2.401 MB after the launch fixes (pass 7, ~1 KB of
 * app code, no new dependency); raised to 2.45 MB on purpose.
 */
const BUDGET = { initial: 2_450_000, chunk: 1_300_000 };

const dir = join(process.argv[2] ?? 'dist', '_expo/static/js/web');
let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`No web export at ${dir}: run \`npx expo export --platform web\` first.`);
  process.exit(1);
}
const sizes = files.map((f) => ({ f, n: statSync(join(dir, f)).size })).sort((a, b) => b.n - a.n);
// What every launch loads: the scripts index.html names (entry and shared chunks).
let html = '';
try {
  html = readFileSync(join(process.argv[2] ?? 'dist', 'index.html'), 'utf8');
} catch {
  // No index.html: fall back to the usual chunk names.
}
const atLaunch = new Set([...html.matchAll(/src="[^"]*\/([^/"]+\.js)"/g)].map((m) => m[1]));
const initial = sizes.filter((x) => (atLaunch.size ? atLaunch.has(x.f) : /^(entry|__common)-/.test(x.f))).reduce((a, x) => a + x.n, 0);
const mb = (n) => (n / 1e6).toFixed(2) + ' MB';

const problems = [];
if (initial > BUDGET.initial) problems.push(`entry + __common is ${mb(initial)}, budget ${mb(BUDGET.initial)}`);
for (const x of sizes) if (x.n > BUDGET.chunk) problems.push(`${x.f} is ${mb(x.n)}, budget ${mb(BUDGET.chunk)} per chunk`);

console.log(`Bundle: ${mb(initial)} at launch, ${sizes.length} chunks; largest:`);
for (const x of sizes.slice(0, 4)) console.log(`  ${mb(x.n)}  ${x.f}`);
if (problems.length) {
  console.error(`\n${problems.join('\n')}\nLoad the new dependency lazily (import() or require inside the function that needs it), or raise the budget on purpose.`);
  process.exit(1);
}
