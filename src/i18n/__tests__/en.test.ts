/// <reference types="node" />
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import en from '../en';

const SRC = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'i18n' ? [] : sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

// Every string passed to t() as a literal must have an English entry, or English
// users see Portuguese in the middle of the app. A poker term that is the same
// in English still needs an entry ('Stack': 'Stack').
test('every t() string has an English translation', () => {
  const missing: string[] = [];
  for (const file of sources(SRC)) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      const key = m[1].replace(/\\'/g, "'");
      if (!(key in en)) missing.push(`${file.slice(SRC.length + 1)}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});
