/// <reference types="node" />
// Sessions from a pasted list of tournament results (Session.cashList) stay out of the
// totals by default, but never out of a backup: the copy holds every session, and the
// player's choice to count them comes back with it.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { prepare, toSessions } from '../../import/convert';
import { cashSessions, parseResults } from '../../import/results';
import { buildReport } from '../../export/report';
import { yearReview } from '../../share/year-review';
import { buildBackup, parseBackup, restoredSettings, sessionsCsv } from '../backup';
import { monthRecap } from '../month-recap';
import { breakdown, countedSessions, totals } from '../session-math';
import { DEFAULT_SETTINGS, type Session } from '../types';

const listed = cashSessions(parseResults('2024-03-12 €550 Main Event 23rd €12.400\n2024-03-13 €220 Turbo 4th €1.980').rows, { currency: '€', tableSize: 9 }).sessions;
const logged = { ...listed[0], id: 'mine', cashList: undefined, name: 'Cash game' } as Session;

test('a backup holds the sessions left out of the totals, still marked', () => {
  const b = buildBackup({ hands: [], sessions: [logged], allSessions: [logged, ...listed], players: [], settings: DEFAULT_SETTINGS }, 1);
  assert.deepEqual(b.sessions.map((s) => s.id), ['mine', ...listed.map((s) => s.id)]);
  const back = parseBackup(JSON.stringify(b));
  assert.deepEqual(back.sessions.filter((s) => s.cashList).map((s) => s.id), listed.map((s) => s.id));
});

test('without allSessions (older callers) the backup is what it was', () => {
  assert.deepEqual(buildBackup({ hands: [], sessions: [logged], players: [], settings: DEFAULT_SETTINGS }, 1).sessions.map((s) => s.id), ['mine']);
});

test('the choice to count them comes back on a new phone; missing means not counted', () => {
  assert.equal(restoredSettings(DEFAULT_SETTINGS, { countCashLists: true }, true).countCashLists, true);
  assert.equal(restoredSettings(DEFAULT_SETTINGS, { countCashLists: 'yes' as unknown as boolean }, true).countCashLists, undefined);
  assert.equal(DEFAULT_SETTINGS.countCashLists, undefined);
});

test('the totals leave them out until the player counts them; nothing to leave out keeps the same list', () => {
  const all = [logged, ...listed];
  assert.deepEqual(countedSessions(all, false).map((s) => s.id), ['mine']);
  assert.equal(countedSessions(all, true), all);
  const none = [logged];
  assert.equal(countedSessions(none, false), none);
});

test('a Sweatbook CSV keeps the mark: export, import again, still from a results list', () => {
  const csv = sessionsCsv([logged, ...listed]);
  const file = prepare(csv);
  assert.equal(file.source, 'sweatbook');
  const back = toSessions(file.table, file.mapping, { currency: '€', tableSize: 9, source: file.source }).sessions;
  const marked = Object.fromEntries(back.map((s) => [s.id, s.cashList ?? false]));
  assert.deepEqual(marked, { mine: false, ...Object.fromEntries(listed.map((s) => [s.id, true])) });
  // Prizes and buy-ins come back as they were.
  for (const s of listed) {
    const b = back.find((x) => x.id === s.id)!;
    assert.deepEqual([b.buyIn, b.cashOut, b.finish, b.kind], [s.buyIn, s.cashOut, s.finish, 'mtt']);
  }
});

test('another app\'s CSV with a column of that name marks nothing', () => {
  const file = prepare('Date,Game,Profit,cash_list\n2024-03-12,NLH,100,1\n');
  const back = toSessions(file.table, file.mapping, { currency: '€', tableSize: 9, source: file.source }).sessions;
  assert.equal(back[0]?.cashList, undefined);
});

test('counted, results with no hours never change the hourly rate anywhere', () => {
  const H = 3600000;
  const at = new Date(2024, 2, 12, 20).getTime();
  const timed = { ...logged, id: 'timed', kind: 'mtt', startedAt: at, endedAt: at + 4 * H, buyIn: 100, entries: 1, addOn: 0, cashOut: 200, venue: 'Estoril' } as Session;
  const cashes = listed.map((s) => ({ ...s, startedAt: at, endedAt: at, venue: 'Estoril' }));
  const all = countedSessions([timed, ...cashes], true);
  const t = totals(all, '€');
  assert.equal(t.hours, 4);
  assert.equal(t.hourly, 25, 'only the timed session: +100 in 4 h');
  assert.ok(t.profit > 100, 'the prizes do count in the profit');
  assert.equal(breakdown(all, 'venue', '€')[0].hourly, 25);
  assert.equal(monthRecap(all, '2024-03', '€').hourly, 25);
  assert.equal(yearReview(2024, all, []).hourly, 25);
  const r = buildReport({ sessions: all, transfers: [], bankrolls: [], range: { from: 0, to: Number.MAX_SAFE_INTEGER } } as never);
  assert.equal(r.currencies[0].byMonth[0].hourly, 25);
});
