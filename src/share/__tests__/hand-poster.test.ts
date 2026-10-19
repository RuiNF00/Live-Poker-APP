/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import { storyMoment } from '../../story/moment';
import { posterStats, posterTitle } from '../hand-poster';

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

test('the poster title keeps the words of the game name, not the money in it', () => {
  assert.equal(posterTitle('Torneio de domingo €550'), 'Torneio de domingo');
  assert.equal(posterTitle('Cash 2/5 €'), 'Cash');
  assert.equal(posterTitle('€1/€2 Noite'), 'Noite');
  assert.equal(posterTitle('Liga 100€ · Final'), 'Liga · Final');
  assert.equal(posterTitle('High Roller $5k'), 'High Roller');
  assert.equal(posterTitle('Mystery R$ 300'), 'Mystery');
  // Numbers without a currency are not money.
  assert.equal(posterTitle('6-Max 2025'), '6-Max 2025');
  // Only money: the poster falls back to «Torneio» or «Cash».
  assert.equal(posterTitle('1/2 €'), '');
  assert.equal(posterTitle(undefined), '');
});

test('the question poster options are in big blinds in cash and tournaments, never money or chips', () => {
  const base = sampleHand('p');
  for (const kind of ['cash', 'mtt'] as const) {
    const h = { ...base, game: { ...base.game, kind } };
    const opts = storyMoment(h, 'question', true).options;
    assert.ok(opts.some((o) => /\d/.test(o.label)), 'the sample has a sized option');
    for (const o of opts) assert.match(o.label, /^(Fold|Check|Call all-in)$|bb$/i, o.label);
    // The story's own moment, when the player shows amounts, is what the poster must not use.
    assert.ok(storyMoment(h, 'question', false).options.some((o) => /\d/.test(o.label) && !/bb$/i.test(o.label)));
  }
});
