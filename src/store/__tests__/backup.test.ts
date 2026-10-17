/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup, importSummary, mergeById, parseBackup, sessionsCsv } from '../backup';
import { DEFAULT_SETTINGS, type Session } from '../types';

const sess = (over: Partial<Session> = {}): Session => ({
  id: 's1', kind: 'cash', name: 'NLH 1/2, "deep"', venue: 'Estoril', currency: '€', startedAt: Date.UTC(2026, 9, 1), endedAt: Date.UTC(2026, 9, 1) + 2 * 3600000,
  breaks: [], buyIn: 200, entries: 1, addOn: 0, cashOut: 450, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 200, stackLog: [], roster: [], notes: '',
  ...over,
});

test('round trip through JSON', () => {
  const b = buildBackup({ hands: [], sessions: [sess()], players: [], backers: [], packages: [], payments: [], settings: DEFAULT_SETTINGS }, 5);
  const back = parseBackup(JSON.stringify(b));
  assert.equal(back.sessions.length, 1);
  assert.equal(back.exportedAt, 5);
});

test('rejects other files and drops broken items', () => {
  assert.throws(() => parseBackup('nope'), /invalid/);
  assert.throws(() => parseBackup('{"app":"other","v":1}'), /invalid/);
  const b = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, hands: [{ id: 'x' }, null], sessions: [{ id: 'a', startedAt: 1 }, { startedAt: 2 }], players: [{ id: 'p', name: 'Z' }] }));
  assert.deepEqual([b.hands.length, b.sessions.length, b.players.length], [0, 1, 1]);
});

test('merge keeps the newer copy and counts new items', () => {
  const r = mergeById([{ id: 'a', updatedAt: 5, v: 'local' }, { id: 'b', updatedAt: 9, v: 'local' }], [{ id: 'a', updatedAt: 7, v: 'in' }, { id: 'b', updatedAt: 1, v: 'in' }, { id: 'c', v: 'in' }]);
  assert.equal(r.added, 1);
  assert.deepEqual(r.list.map((x) => x.v), ['in', 'local', 'in']);
});

test('csv quotes and computes profit', () => {
  const csv = sessionsCsv([sess(), sess({ id: 'live', endedAt: undefined })]);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 2);
  // Local date and start time, ..., hours, hands (none counted), ..., expenses, tips, profit.
  assert.match(lines[1], /^2026-10-01,\d\d:\d\d,cash,live,,"NLH 1\/2, ""deep""",Estoril,€,2\.00,,200,1,0,200,450,0,,0,0,250,,,,,,,$/);
});

test('importSummary mentions bankrolls and transfers only when some came in', () => {
  assert.ok(!importSummary({ hands: 1, sessions: 2, players: 0 }).includes('bankroll'));
  const s = importSummary({ hands: 0, sessions: 0, players: 0, bankrolls: 2, transfers: 3 });
  assert.ok(s.includes('2 bankrolls · 3 movimentos'), s);
});

test('players you back go through a backup and come back validated, next to trips', async () => {
  const { buildStatement } = await import('../../lib/backing-link');
  const st = buildStatement({ id: 'b1', name: 'Eu', note: '', shareKey: 'k_test01', createdAt: 0 }, 'Rui', '€', [], [], [], 9);
  const b = buildBackup({ hands: [], sessions: [], players: [], backing: [{ id: st.id, statement: st, createdAt: 1 }], trips: [], settings: DEFAULT_SETTINGS }, 5);
  const back = parseBackup(JSON.stringify(b));
  assert.deepEqual(back.backing, b.backing);
  assert.deepEqual(back.trips, []);
  // A tampered statement is dropped, the rest of the backup still loads.
  const bad = JSON.parse(JSON.stringify(b));
  bad.backing.push({ id: 'x', statement: { v: 9 } });
  assert.equal(parseBackup(JSON.stringify(bad)).backing?.length, 1);
});
