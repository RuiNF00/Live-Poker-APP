/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBackup, importSummary, mergeById, parseBackup, restoredSettings, sessionsCsv } from '../backup';
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
  // Midnight UTC is the 30th west of Greenwich: the date is local.
  assert.match(lines[1], /^2026-(09-30|10-01),\d\d:\d\d,cash,live,,"NLH 1\/2, ""deep""",Estoril,€,2\.00,,200,1,0,200,450,0,,0,0,250,,,,,,,,,,$/);
});

test('csv says the day a multi-day tournament reached and the bagged stack', () => {
  const s = sess({ kind: 'mtt', name: 'Main Event', day: 2, bag: { stack: 154000, at: 1 } });
  const [head, row] = sessionsCsv([s]).trim().split('\n');
  const cols = head.split(',');
  const cells = row.split(',');
  assert.equal(cells[cols.indexOf('mtt_day')], '2');
  assert.equal(cells[cols.indexOf('bagged_stack')], '154000');
});

test('importSummary also counts staking packages, payments and players you back', () => {
  const s = importSummary({ hands: 0, sessions: 0, players: 0, packages: 2, payments: 1, backing: 1 });
  assert.ok(s.includes('2 pacotes de staking · 1 pagamento a backers · 1 jogador que apoias'), s);
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

test('a restore on an empty phone brings the preferences back; a phone in use keeps its own', () => {
  const saved = { ...DEFAULT_SETTINGS, currency: '$', bankrollId: 'b1', hideAmounts: true, nickname: 'Rui', onboarded: true };
  const parsed = parseBackup(JSON.stringify(buildBackup({ hands: [], sessions: [], players: [], settings: saved })));
  const fresh = restoredSettings({ ...DEFAULT_SETTINGS, onboarded: true }, parsed.settings, true);
  assert.equal(fresh.currency, '$');
  assert.equal(fresh.bankrollId, 'b1');
  assert.equal(fresh.hideAmounts, true);
  assert.equal(fresh.nickname, 'Rui');
  assert.equal(fresh.onboarded, true);
  const inUse = restoredSettings({ ...DEFAULT_SETTINGS, currency: '£', onboarded: true }, parsed.settings, false);
  assert.equal(inUse.currency, '£');
  assert.equal(inUse.bankrollId, undefined);
  assert.equal(inUse.nickname, 'Rui');
  // Junk in the file never lands in settings.
  const junk = restoredSettings(DEFAULT_SETTINGS, { currency: 42 as unknown as string, defaultTableSize: 99 }, true);
  assert.equal(junk.currency, DEFAULT_SETTINGS.currency);
  assert.equal(junk.defaultTableSize, DEFAULT_SETTINGS.defaultTableSize);
});
