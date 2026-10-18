/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import { posterStats } from '../hand-poster';

test('poster numbers are in big blinds, never money', () => {
  const h = sampleHand('p');
  const stats = posterStats(h);
  assert.ok(stats.length > 0);
  for (const s of stats) assert.match(s.value, /bb$/);
  // Always in this order: pot, stack, result.
  assert.deepEqual(stats.map((s) => s.key), (['pot', 'stack', 'net'] as const).filter((k) => stats.some((s) => s.key === k)));
});

test('the result carries its sign and tone, and a hand without blinds has no numbers', () => {
  const h = sampleHand('p');
  const net = posterStats(h).find((s) => s.key === 'net');
  if (net) assert.equal(net.tone, net.value.startsWith('+') ? 'good' : 'bad');
  assert.deepEqual(posterStats({ ...h, game: { ...h.game, bb: 0 } }), []);
});
