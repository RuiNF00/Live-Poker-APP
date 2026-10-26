/// <reference types="node" />
// Sessions from a pasted list of tournament results (Session.cashList) stay out of the
// totals by default, but never out of a backup: the copy holds every session, and the
// player's choice to count them comes back with it.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cashSessions, parseResults } from '../../import/results';
import { buildBackup, parseBackup, restoredSettings } from '../backup';
import { countedSessions } from '../session-math';
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
