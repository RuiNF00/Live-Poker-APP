#!/usr/bin/env node
// Store builds never carry the test flags (src/billing/dev-pro.ts): local Pro and
// screenshot Pro. Not in this shell, not in eas.json, not in any .env file.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
let bad = false;
for (const NAME of ['EXPO_PUBLIC_LOCAL_PRO', 'EXPO_PUBLIC_SCREENSHOTS']) {
  const found = [];
  if (process.env[NAME] !== undefined) found.push('the environment of this shell');
  for (const f of ['eas.json', ...readdirSync(root).filter((x) => x.startsWith('.env') && x !== '.env.example')]) {
    try {
      if (readFileSync(join(root, f), 'utf8').includes(NAME)) found.push(f);
    } catch {
      // no such file
    }
  }
  if (found.length) {
    console.error(`${NAME} is set in ${found.join(', ')}. It is only for local test builds.`);
    bad = true;
  } else console.log(`${NAME}: not set`);
}
if (bad) process.exit(1);
