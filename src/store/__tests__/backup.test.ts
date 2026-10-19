/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCsv } from '../../import/csv';
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

test('a session without breaks gets an empty list, so the time sums do not crash', () => {
  const b = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, sessions: [{ id: 'a', startedAt: 1, endedAt: 3_600_001 }, { id: 'b', startedAt: 2, breaks: 'x' }] }));
  assert.deepEqual(b.sessions.map((s) => s.breaks), [[], []]);
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
  // Midnight UTC is the 30th west of Greenwich: the date is local. Then exact start, end and id, for the import.
  assert.match(lines[1], /^2026-(09-30|10-01),\d\d:\d\d,cash,live,,"NLH 1\/2, ""deep""",Estoril,€,2,,200,1,0,200,450,0,,0,0,250,,,,,,,,,,,,[\d-]{10} [\d:]{8},[\d-]{10} [\d:]{8},s1$/);
});

test('csv for Excel in Portuguese: semicolons, decimal commas, no formulas, a lone CR quoted, cost to the cent', () => {
  const s = sess({ buyIn: 33.3, entries: 3, notes: '=HYPERLINK("http://x")\rsegunda' });
  const [head, row] = sessionsCsv([s], [], [], [], ';').trim().split('\n');
  const cols = head.split(';');
  assert.equal(cols.length, 34);
  const cells = parseCsv(head + '\n' + row + '\n', ';')[1];
  assert.equal(cells.length, 34);
  assert.equal(cells[cols.indexOf('total_cost')], '99,9');
  assert.ok(row.includes(`"'=HYPERLINK(""http://x"")\rsegunda"`), 'kept as text in the spreadsheet');
  assert.equal(cells[cols.indexOf('notes')], '=HYPERLINK("http://x")\rsegunda', 'the import reads back what was typed');
  assert.equal(cells[cols.indexOf('id')], 's1');
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

test('backup carries quarantined values, and a restore can only write quarantine keys', () => {
  const q: [string, string][] = [['rl.quarantine.v1.1.rl.hand.v2.h1', '{"id":"h1"']];
  const b = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, quarantine: q });
  const back = parseBackup(JSON.stringify({ ...b, quarantine: [...q, ['rl.settings.v1', '{}'], ['rl.quarantine.v1.2.x', 5], 'x'] }));
  assert.deepEqual(back.quarantine, q);
  assert.equal(buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS }).quarantine, undefined);
});

test('the restore summary lists swaps when the backup brought any', () => {
  assert.match(importSummary({ hands: 0, sessions: 1, players: 0, swaps: 2 }), /2 swaps/);
  assert.match(importSummary({ hands: 0, sessions: 1, players: 0, swaps: 1 }), /1 swap\b/);
  assert.doesNotMatch(importSummary({ hands: 0, sessions: 1, players: 0 }), /swap/);
});

test('backup carries festival plans and own festivals, and drops what the planner cannot read', () => {
  const ev = { id: 'o1', number: 100001, name: 'Deepstack', unnumbered: true, game: 'NLH', buyIn: 250, guarantee: 0, start: '2026-11-02T18:00', own: true } as const;
  const plan = { picked: ['12-A', 'o1'], lateReg: { '12-A': 120 }, sessions: { '12-A': 's1' }, name: 'Lisboa', events: [ev] };
  const fest = { id: 'own-1', name: 'Casino Night', venue: 'Porto', city: '', currency: '€', utcOffset: 60, source: { label: '', checked: '2026-10-01' }, notes: [], events: [], dates: { from: '2026-11-01', to: '2026-11-05' }, own: true };
  const b = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, festivalPlans: { lis: plan }, ownFestivals: [fest] });
  const back = parseBackup(JSON.stringify(b));
  assert.deepEqual(back.festivalPlans, { lis: plan });
  assert.deepEqual(back.ownFestivals, [fest]);
  const junk = parseBackup(
    JSON.stringify({
      ...b,
      festivalPlans: JSON.parse('{"__proto__":{"picked":[]},"x":{"picked":"no"},"y":{"picked":["a",3],"lateReg":{"a":"x","b":30},"events":[{"id":"e"}]}}'),
      ownFestivals: [fest, { ...fest, id: 'own-2', own: false }, { ...fest, id: 'own-3', dates: { from: 'soon', to: '2026-11-05' } }, { ...fest, id: 'own-4', notes: ['<b>'], source: { label: 'x' } }],
    }),
  );
  assert.deepEqual(Object.keys(junk.festivalPlans ?? {}), ['y']);
  assert.deepEqual(junk.festivalPlans?.y, { picked: ['a'], lateReg: { b: 30 }, sessions: {} });
  assert.deepEqual(junk.ownFestivals?.map((f) => f.id), ['own-1', 'own-4']);
  assert.deepEqual(junk.ownFestivals?.[1].notes, []);
  // Older copies have neither.
  const old = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, hands: [], sessions: [], players: [] }));
  assert.deepEqual(old.festivalPlans, {});
  assert.deepEqual(old.ownFestivals, []);
});

test('festival events from a file keep only the fields the planner knows', () => {
  const ev = { id: 'o1', number: 100001, name: 'Deepstack', game: 'NLH', buyIn: 250, start: '2026-11-02T18:00', evil: '<script>', own: true };
  const b = parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, hands: [], sessions: [], players: [], festivalPlans: { x: { picked: [], events: [ev] } } }));
  assert.deepEqual(b.festivalPlans?.x.events, [{ id: 'o1', number: 100001, name: 'Deepstack', game: 'NLH', buyIn: 250, guarantee: 0, start: '2026-11-02T18:00', own: true }]);
});

test('backup carries weekly tournaments, checked field by field', () => {
  const w = { id: 'w1', name: 'Quinta Deepstack', venue: 'Estoril', currency: '€', weekday: 4, time: '21:00', buyIn: 60, stack: 30000, levelMinutes: 20 };
  const b = buildBackup({ hands: [], sessions: [], players: [], settings: DEFAULT_SETTINGS, weekly: [w] });
  assert.deepEqual(parseBackup(JSON.stringify(b)).weekly, [w]);
  const junk = parseBackup(JSON.stringify({ ...b, weekly: [{ ...w, evil: 1 }, { ...w, id: 'w2', weekday: 7 }, { ...w, id: 'w3', time: '25:00' }, { ...w, id: 'w4', buyIn: 'x' }] }));
  assert.deepEqual(junk.weekly, [w]);
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'sweatbook', v: 1, hands: [], sessions: [], players: [] })).weekly, []);
});
