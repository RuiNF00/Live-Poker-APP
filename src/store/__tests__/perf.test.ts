/// <reference types="node" />
// Five years of a heavy player (2,000 sessions, 10,000 hands, 50 backers) must
// stay fast. Phone budgets: cold start under 2 s and every stat under 200 ms on
// a mid-range Android, which runs this JS about 6× slower than Node. The limits
// below are those budgets in Node time with 2× headroom for a busy CI runner:
// they catch an accidental O(n²) or a full replay on the render path, not noise.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countInSlices } from '@/lib/idle-count';

import { bench } from './perf-bench';

const BOOT_MS = 2000 / 6 * 2; // reading and checking everything stored
const STAT_MS = 200 / 6 * 2; // any one screen's numbers

test('5 anos de dados: arranque e estatísticas dentro do orçamento', async () => {
  const r = await bench();
  const over: string[] = [];
  for (const [name, ms] of Object.entries(r)) {
    if (name.startsWith('início: mãos incompletas')) continue; // runs in slices after the first frame (below)
    const limit = name.startsWith('arranque') ? BOOT_MS : STAT_MS;
    if (ms > limit) over.push(`${name}: ${ms} ms (limite ${limit.toFixed(0)} ms)`);
  }
  assert.deepEqual(over, [], 'Lento com 5 anos de dados:\n' + over.join('\n'));
});

test('a contagem que precisa de replay não bloqueia o primeiro ecrã', () => {
  const items = Array.from({ length: 10000 }, (_, i) => i);
  let seen = 0;
  const queue: (() => void)[] = [];
  let result: number | null = null;
  countInSlices(items, (x) => (seen++, x % 3 === 0), (n) => (result = n), (f) => queue.push(f));
  // Synchronously only the first slice ran.
  assert.ok(seen <= 250, `primeiro passo fez ${seen}`);
  assert.equal(result, null);
  while (queue.length) queue.shift()!();
  assert.equal(result, 3334);
});

test('cancelar a contagem pára os passos seguintes', () => {
  const queue: (() => void)[] = [];
  let result: number | null = null;
  const cancel = countInSlices(Array.from({ length: 1000 }, (_, i) => i), () => true, (n) => (result = n), (f) => queue.push(f));
  cancel();
  while (queue.length) queue.shift()!();
  assert.equal(result, null);
});
