/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup, mergeById } from '../backup';
import { mergeBackups, writtenElsewhere } from '../backup-merge';
import { revive } from '../deleted-math';
import type { WeeklyTournament } from '../weekly';
import type { Festival } from '../../poker/festivals';
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

test('two phones: an own festival or weekly tournament deleted on one doesn’t come back from the other', () => {
  const fest = (id: string, updatedAt?: number) => ({ id, name: 'Malta, novembro 2026', venue: '', city: '', currency: '€', utcOffset: 0, source: { label: '', checked: '' }, notes: [], events: [], dates: { from: '2026-11-05', to: '2026-11-12' }, own: true, ...(updatedAt ? { updatedAt } : {}) });
  const w = (id: string, updatedAt?: number) => ({ id, name: id, venue: '', currency: '€', weekday: 4, time: '21:00', buyIn: 60, ...(updatedAt ? { updatedAt } : {}) });
  // A deleted Malta and w1 at 200; B still has both, and adds a session.
  const a = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, ownFestivals: [], weekly: [], deleted: { 'ownFestivals:fx_1': 200, 'weekly:w1': 200 } }, 300);
  const b = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, ownFestivals: [fest('fx_1', 100)], weekly: [w('w1')] }, 250);
  for (const m of [mergeBackups(a, b), mergeBackups(b, a)]) {
    assert.deepEqual(m.ownFestivals, []);
    assert.deepEqual(m.weekly, []);
  }
  // Edited on B after A's delete: the edit wins.
  const edited = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, ownFestivals: [fest('fx_1', 260)], weekly: [w('w1', 260)] }, 270);
  assert.deepEqual(mergeBackups(a, edited).ownFestivals?.map((f) => f.id), ['fx_1']);
  assert.deepEqual(mergeBackups(a, edited).weekly?.map((x) => x.id), ['w1']);
  // Saved again on both: the later save of each.
  assert.equal(mergeBackups(b, edited).ownFestivals?.[0].updatedAt, 260);
});

test('a file restore brings back an own festival and weekly tournament deleted here', () => {
  const fest: Festival = { id: 'fx_1', name: 'Malta', venue: '', city: '', currency: '€', utcOffset: 0, source: { label: '', checked: '' }, notes: [], events: [], dates: { from: '2026-11-05', to: '2026-11-12' }, own: true };
  const w: WeeklyTournament = { id: 'w1', name: 'Quinta', venue: '', currency: '€', weekday: 4, time: '21:00', buyIn: 60 };
  const { backup, revived } = revive({ ownFestivals: [fest], weekly: [w] }, { 'ownFestivals:fx_1': 200, 'weekly:w1': 200 }, 900);
  assert.deepEqual(revived.sort(), ['ownFestivals:fx_1', 'weekly:w1']);
  assert.equal(backup.ownFestivals[0].updatedAt, 900);
  assert.equal(backup.weekly[0].updatedAt, 900);
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
