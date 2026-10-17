/// <reference types="node" />
// The bankroll screens with five years of a heavy player stay within the same
// per-screen budget as perf.test.ts (200 ms on a mid-range phone).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { benchBankroll } from './perf-bankroll';

const STAT_MS = (200 / 6) * 2;

test('bankroll com 5 anos de dados: cada ecrã dentro do orçamento', () => {
  const r = benchBankroll();
  const over = Object.entries(r)
    .filter(([, ms]) => ms > STAT_MS)
    .map(([name, ms]) => `${name}: ${ms} ms (limite ${STAT_MS.toFixed(0)} ms)`);
  assert.deepEqual(over, [], 'Lento com 5 anos de dados:\n' + over.join('\n'));
});
