/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { festivalPicks, firstAction, isMtt, planFor, PLAYS, startProgress, startSteps } from '../onboarding';

test('plan follows what they play and want', () => {
  const p = planFor({ goals: ['results', 'backers'], plays: 'mtt3', volume: 'lots' });
  assert.equal(p.title, 'O teu caderno de torneios');
  assert.deepEqual(p.points, ['Bankroll, ROI e ITM por sala', 'Staking: quanto deves a cada backer, com makeup', 'Mãos registadas em segundos, entre mãos', 'Planeador de festivais, com lembretes de late reg']);
  assert.deepEqual(p.pro, ['Mãos sem limite: o grátis fica pelas 3 por dia', 'Filtros por sala, jogo e stake, e CSV']);
});

test('skipped quiz still gets a plan', () => {
  const p = planFor({ goals: [], plays: null, volume: null });
  assert.equal(p.title, 'O teu caderno de póquer live');
  assert.equal(p.points.length, 1);
});

test('first-week checklist reads from the data', () => {
  assert.deepEqual(startProgress({ hands: [{}, {}, { shareId: 'x' }], sessions: 0, deposits: 1 }), { hand: true, session: false, bankroll: true, festival: false, share: true });
  assert.deepEqual(startProgress({ hands: [{}], sessions: 2, deposits: 0 }), { hand: false, session: true, bankroll: false, festival: false, share: false });
});

test('the stakes ladder reaches high stakes, and old answers still read', () => {
  assert.ok(PLAYS.some((p) => p.key === 'cash2' && p.stakes.startsWith('3/5')));
  assert.ok(PLAYS.some((p) => p.stakes.startsWith('50/100')));
  assert.ok(isMtt('mttHigh') && isMtt('mtt1') && !isMtt('cash4') && !isMtt(null));
});

test('tournament players get a festival step in the first week', () => {
  assert.deepEqual(startSteps('mtt2').map((s) => s.key), ['hand', 'session', 'festival', 'share']);
  assert.deepEqual(startSteps('cash1').map((s) => s.key), ['hand', 'session', 'bankroll', 'share']);
  assert.equal(startProgress({ hands: [], sessions: 0, deposits: 0, festivalPicks: 2 }).festival, true);
});

test('the festival step counts picks on any festival, not only the first one shipped', () => {
  // The step opens the festival that starts first, which is not the first in the shipped list.
  assert.equal(festivalPicks({}), 0);
  assert.equal(festivalPicks({ 'lisboa-nov-2026': { picked: ['e1', 'e2'] }, 'bahamas-dez-2026': { picked: [] } }), 2);
  assert.equal(festivalPicks({ a: { picked: ['x'] }, b: { picked: ['y'] }, c: undefined }), 2);
});

test('the plan ends on a first action that fits the answers, never staking', () => {
  assert.equal(firstAction({ goals: ['discuss'], plays: 'mtt2', volume: null }), 'hand');
  assert.equal(firstAction({ goals: ['leaks', 'discuss'], plays: 'cash1', volume: null }), 'hand');
  assert.equal(firstAction({ goals: ['results', 'discuss'], plays: 'mtt1', volume: null }), 'festival');
  assert.equal(firstAction({ goals: ['backers'], plays: 'cash3', volume: null }), 'past');
  assert.equal(firstAction({ goals: [], plays: null, volume: null }), 'past');
});
