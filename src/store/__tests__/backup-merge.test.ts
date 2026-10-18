/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup, mergeById } from '../backup';
import { mergeBackups, writtenElsewhere } from '../backup-merge';
import { DEFAULT_SETTINGS, type PlayerNote } from '../types';

const note = (id: string, updatedAt: number, text = id): PlayerNote => ({ id, name: id, notes: text, updatedAt }) as unknown as PlayerNote;

test('two phones: the upload keeps both phones’ items, the newer copy of each, and this phone’s settings', () => {
  const a = buildBackup({ hands: [], sessions: [], players: [note('p1', 5, 'A'), note('p2', 1)], settings: { ...DEFAULT_SETTINGS, currency: '€' }, festivalPlans: { lis: { picked: ['1'], lateReg: {}, sessions: {} } } }, 100);
  const b = buildBackup({ hands: [], sessions: [], players: [note('p1', 9, 'B'), note('p3', 2)], settings: { ...DEFAULT_SETTINGS, currency: '$' }, festivalPlans: { lis: { picked: ['2'], lateReg: {}, sessions: {} } }, quarantine: [['rl.quarantine.v1.x', '{']] }, 90);
  const m = mergeBackups(a, b);
  assert.deepEqual(m.players.map((p) => [p.id, (p as unknown as { notes: string }).notes]).sort(), [['p1', 'B'], ['p2', 'p2'], ['p3', 'p3']]);
  assert.equal(m.settings?.currency, '€');
  assert.equal(m.exportedAt, 100);
  assert.deepEqual(m.festivalPlans?.lis.picked, ['1', '2']);
  assert.deepEqual(m.quarantine, [['rl.quarantine.v1.x', '{']]);
});

test('only a copy another phone wrote is joined in', () => {
  assert.equal(writtenElsewhere({ exportedAt: 100 }, 100), false);
  assert.equal(writtenElsewhere({ exportedAt: 120 }, 100), true);
  // Copies made before this check existed are this phone's own: deleted things don't come back.
  assert.equal(writtenElsewhere({ exportedAt: 100 }, undefined), false);
});

test('two phones: weekly tournaments from both are kept, this phone’s copy of the same one stays', () => {
  const w = (id: string, buyIn: number) => ({ id, name: id, venue: '', currency: '€', weekday: 4, time: '21:00', buyIn });
  const a = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, weekly: [w('w1', 60)] }, 100);
  const b = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, weekly: [w('w1', 80), w('w2', 30)] }, 90);
  assert.deepEqual(mergeBackups(a, b).weekly?.map((x) => [x.id, x.buyIn]), [['w1', 60], ['w2', 30]]);
});

test('a restore merges into the list as it is when applied: a hand saved during the download stays', () => {
  const h = (id: string, updatedAt = 1) => ({ id, updatedAt });
  // What importData does for each list: an updater, not the list it saw when it started.
  const into = <T extends { id: string; updatedAt?: number }>(incoming: T[]) => (cur: T[]) => mergeById(cur, incoming).list;
  let state = [h('local')];
  const update = into([h('remote'), h('local', 0)]);
  state = [...state, h('saved-meanwhile')];
  state = update(state);
  assert.deepEqual(state.map((x) => x.id).sort(), ['local', 'remote', 'saved-meanwhile']);
});

test('two phones: a session deleted on one stays deleted after the other uploads an edit (QA ronda 5)', () => {
  const s = (id: string, updatedAt: number) => ({ id, updatedAt }) as unknown as PlayerNote;
  const copy = (players: PlayerNote[], deleted: Record<string, number> | undefined, at: number) => buildBackup({ hands: [], sessions: [], players, settings: DEFAULT_SETTINGS, deleted }, at);
  // B deleted Alpha at 20 and copied: the server holds Bravo and Charlie and the delete.
  const server = copy([s('bravo', 1), s('charlie', 1)], { 'players:alpha': 20 }, 30);
  // A still has Alpha, edits Bravo and copies: Alpha doesn't come back.
  const a = mergeBackups(copy([s('alpha', 1), s('bravo', 40), s('charlie', 1)], {}, 50), server);
  assert.deepEqual(a.players.map((p) => p.id).sort(), ['bravo', 'charlie']);
  assert.deepEqual(a.deleted, { 'players:alpha': 20 });
  // B copies again: still two, with A's edit.
  const b = mergeBackups(copy([s('bravo', 1), s('charlie', 1)], { 'players:alpha': 20 }, 60), a);
  assert.deepEqual(b.players.map((p) => [p.id, p.updatedAt]).sort(), [['bravo', 40], ['charlie', 1]]);
});

test('two phones: an item edited after the other phone deleted it is kept (the edit wins)', () => {
  const s = (id: string, updatedAt: number) => ({ id, updatedAt }) as unknown as PlayerNote;
  const a = buildBackup({ hands: [], sessions: [], players: [s('alpha', 25)], settings: DEFAULT_SETTINGS }, 50);
  const b = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, deleted: { 'players:alpha': 20 } }, 30);
  assert.deepEqual(mergeBackups(a, b).players.map((p) => p.id), ['alpha']);
});
