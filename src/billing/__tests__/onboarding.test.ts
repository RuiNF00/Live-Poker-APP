/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planFor } from '../onboarding';

test('plan follows what they play and want', () => {
  const p = planFor({ goals: ['results', 'backers'], plays: 'mttHigh', volume: 'lots' });
  assert.equal(p.title, 'O teu caderno de torneios');
  assert.deepEqual(p.points, ['Bankroll, ROI e ITM por sala', 'Staking: quanto deves a cada backer, com makeup', 'Mãos registadas em segundos, entre mãos', 'Mãos sem limite em todas as sessões']);
});

test('skipped quiz still gets a plan', () => {
  const p = planFor({ goals: [], plays: null, volume: null });
  assert.equal(p.title, 'O teu caderno de póquer live');
  assert.equal(p.points.length, 1);
});
