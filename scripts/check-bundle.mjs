#!/usr/bin/env node
// Bundle size budget, run on the web export by check:release. What every
// launch downloads and evaluates (entry + shared chunks) must stay under the
// budget, so a heavy new dependency shows up here and not as a slow start.
//
//   node scripts/check-bundle.mjs <export dir>

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bytes, minified. 17 Oct 2026 (merge of 8f…, after #161): entry 1.12 MB,
 * __common 1.58 MB, of which 0.52 MB is the en/es/pt-BR string tables. On
 * phones only the active table is evaluated (#161); on web all three still
 * ship until the async split lands, which should bring __common back to ~1.1 MB.
 * RevenueCat web 1.15 MB sits in its own chunk, loaded when billing starts.
 */
const BUDGET = { initial: 2_850_000, chunk: 1_650_000 };

const dir = join(process.argv[2] ?? 'dist', '_expo/static/js/web');
let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`No web export at ${dir}: run \`npx expo export --platform web\` first.`);
  process.exit(1);
}
const sizes = files.map((f) => ({ f, n: statSync(join(dir, f)).size })).sort((a, b) => b.n - a.n);
const initial = sizes.filter((x) => /^(entry|__common)-/.test(x.f)).reduce((a, x) => a + x.n, 0);
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
