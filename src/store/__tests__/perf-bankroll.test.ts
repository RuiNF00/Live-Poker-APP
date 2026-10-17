/// <reference types="node" />
// The bankroll screens with five years of a heavy player stay within the same
// per-screen budget as perf.test.ts (200 ms on a mid-range phone), with the
// same calibration and best of up to 3 runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { benchBankroll } from './perf-bankroll';
import { slowness } from './perf-calibrate';

const STAT_MS = (200 / 6) * 2;

test('bankroll com 5 anos de dados: cada ecrã dentro do orçamento', () => {
  const slow = slowness();
  const limit = STAT_MS * slow;
  const best: Record<string, number> = {};
  let over: string[] = [];
  for (let run = 0; run < 3; run++) {
    for (const [name, ms] of Object.entries(benchBankroll())) best[name] = Math.min(best[name] ?? Infinity, ms);
    over = Object.entries(best)
      .filter(([, ms]) => ms > limit)
      .map(([name, ms]) => `${name}: ${ms} ms (limite ${limit.toFixed(0)} ms, máquina ${slow.toFixed(1)}× mais lenta)`);
    if (!over.length) break;
  }
  assert.deepEqual(over, [], 'Lento com 5 anos de dados:\n' + over.join('\n'));
});
