/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { entrySeconds, shareDelay } from '../friction';

test('the share delay is a coarse bucket', () => {
  const m = 60_000;
  assert.deepEqual([0, 30_000, 5 * m, 30 * m, 5 * 60 * m, 3 * 1440 * m].map(shareDelay), ['<1m', '<1m', '1-10m', '10-60m', '1-24h', '>1d']);
});

test('entry seconds are whole, never negative, and capped at an hour', () => {
  assert.equal(entrySeconds(1000, 26_400), 25);
  assert.equal(entrySeconds(5000, 1000), 0);
  assert.equal(entrySeconds(0, 10 * 3_600_000), 3600);
});
