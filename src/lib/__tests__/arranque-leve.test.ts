/// <reference types="node" />
// What the web build loads at launch stays light: the heavy modules are reached only from the
// screens that use them. Each check guards a leak that once put tens of KB back in the launch bundle.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../', import.meta.url));
const read = (f: string) => readFileSync(join(src, f), 'utf8');
const files = (dir: string): string[] =>
  readdirSync(join(src, dir)).flatMap((n) => {
    const f = join(dir, n);
    if (n === '__tests__') return [];
    return statSync(join(src, f)).isDirectory() ? files(f) : /\.tsx?$/.test(n) ? [f] : [];
  });

test('only the svg wrapper imports react-native-svg, so the web build keeps it out of launch', () => {
  const direct = files('.').filter((f) => /from 'react-native-svg'/.test(read(f)));
  assert.deepEqual(direct.sort(), ['components/svg.native.ts', 'components/svg.tsx']);
});

test('ending a live session loads the backup crypto only when it calls the server', () => {
  const s = read('lib/live-end.ts');
  assert.doesNotMatch(s, /require\(['"]\.\/backup-crypto['"]\)|from ['"]\.\/backup-crypto['"]/);
  assert.doesNotMatch(s, /from ['"]\.\/live-end-slot['"]/);
  assert.match(s, /import\('\.\/backup-crypto'\)/);
  assert.doesNotMatch(read('lib/lock-screen/index.tsx'), /live-end-slot/);
});

test('the import screen loads the converters only when a file is chosen', () => {
  const s = read('app/import.tsx');
  assert.doesNotMatch(s, /^import \{[^}]*\} from '@\/import\/convert'/m);
  assert.match(s, /import\('@\/import\/convert'\)/);
});
