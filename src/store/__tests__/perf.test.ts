/// <reference types="node" />
// Five years of a heavy player (2,000 sessions, 10,000 hands, 50 backers) must
// stay fast. Phone budgets: cold start under 2 s and every stat under 200 ms on
// a mid-range Android, which runs this JS about 6× slower than Node. The limits
// below are those budgets in Node time with 2× headroom, scaled by how slow
// this machine is right now (a calibration loop against the laptop the numbers
// were measured on), and each step keeps its best of up to 3 runs: they catch
// an accidental O(n²) or a full replay on the render path, not a busy runner.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countInSlices } from '@/lib/idle-count';

import { bench } from './perf-bench';

const BOOT_MS = 2000 / 6 * 2; // reading and checking everything stored
const STAT_MS = 200 / 6 * 2; // any one screen's numbers
/** The calibration loop on the machine the budgets were measured on (17 Oct 2026). */
const CALIBRATION_MS = 65;

/** Best of 5: sorting and round-tripping 200,000 numbers, the same kind of work as the app's. */
function calibrate(): number {
  let best = Infinity;
  for (let k = 0; k < 5; k++) {
    let x = 1;
    const a: number[] = [];
    for (let i = 0; i < 200000; i++) a.push((x = (x * 16807) % 2147483647));
    const t0 = performance.now();
    a.sort((p, q) => p - q);
    JSON.parse(JSON.stringify(a));
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

test('5 anos de dados: arranque e estatísticas dentro do orçamento', async () => {
  const slow = Math.max(1, calibrate() / CALIBRATION_MS);
  const limitOf = (name: string) => (name.startsWith('arranque') ? BOOT_MS : STAT_MS) * slow;
  const best: Record<string, number> = {};
  let over: string[] = [];
  for (let run = 0; run < 3; run++) {
    const r = await bench();
    for (const [name, ms] of Object.entries(r)) best[name] = Math.min(best[name] ?? Infinity, ms);
    over = Object.entries(best)
      // The full replay runs in slices after the first frame (tested below).
      .filter(([name, ms]) => !name.startsWith('início: mãos incompletas') && ms > limitOf(name))
      .map(([name, ms]) => `${name}: ${ms} ms (limite ${limitOf(name).toFixed(0)} ms, máquina ${slow.toFixed(1)}× mais lenta)`);
    if (!over.length) break;
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
