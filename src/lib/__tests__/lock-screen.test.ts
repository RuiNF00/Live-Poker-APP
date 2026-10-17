/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../../store/types';
import { levelAfter, levelUpMessage, liveProps, nextLevelAt, withLevelClock } from '../lock-screen/live-state';

const MIN = 60_000;

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main Event', venue: 'Estoril', currency: '€', startedAt: 0, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 400, bb: 800, ante: 800, anteType: 'bb', level: 6, tableSize: 9, stack: 42000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('next level: start + length, pushed back by breaks inside the level', () => {
  const s = mk({ levelMinutes: 30, levelStartedAt: 60 * MIN });
  assert.equal(nextLevelAt(s, 70 * MIN), 90 * MIN);
  // A 10-minute break in the level moves it 10 minutes; one before the level doesn't.
  const b = mk({ levelMinutes: 30, levelStartedAt: 60 * MIN, breaks: [{ start: 30 * MIN, end: 40 * MIN }, { start: 65 * MIN, end: 75 * MIN }] });
  assert.equal(nextLevelAt(b, 80 * MIN), 100 * MIN);
  // A break still running counts up to now.
  const open = mk({ levelMinutes: 30, levelStartedAt: 60 * MIN, breaks: [{ start: 70 * MIN }] });
  assert.equal(nextLevelAt(open, 75 * MIN), 95 * MIN);
});

test('no level length, no start or an ended session: no next level', () => {
  assert.equal(nextLevelAt(mk()), undefined);
  assert.equal(nextLevelAt(mk({ levelMinutes: 20 })), undefined);
  assert.equal(nextLevelAt(mk({ levelMinutes: 20, levelStartedAt: 1, endedAt: 2 })), undefined);
});

test('level clock restarts on a level change or when first set, not on other edits', () => {
  const prev = mk({ levelMinutes: 20, levelStartedAt: 5 * MIN });
  assert.equal(withLevelClock(prev, { ...prev, stack: 50000 }, 9 * MIN).levelStartedAt, 5 * MIN);
  assert.equal(withLevelClock(prev, { ...prev, ...levelAfter(prev, 1) }, 9 * MIN).levelStartedAt, 9 * MIN);
  assert.equal(withLevelClock(mk(), mk({ levelMinutes: 20 }), 7 * MIN).levelStartedAt, 7 * MIN);
  // Changing the length clears the start on the screen, which restarts the clock here.
  assert.equal(withLevelClock(prev, { ...prev, levelMinutes: 30, levelStartedAt: undefined }, 8 * MIN).levelStartedAt, 8 * MIN);
  // Without a length nothing is stamped.
  assert.equal(withLevelClock(undefined, mk(), 1).levelStartedAt, undefined);
});

test('levelAfter walks the blinds ladder and keeps the ante type', () => {
  assert.deepEqual(levelAfter(mk(), 1), { sb: 500, bb: 1000, ante: 1000, level: 7 });
  assert.deepEqual(levelAfter(mk(), -1), { sb: 300, bb: 600, ante: 600, level: 5 });
  assert.deepEqual(levelAfter(mk({ sb: 100, bb: 200, level: 1 }), -1), { sb: 100, bb: 200, ante: 200, level: 1 });
  assert.deepEqual(levelAfter(mk({ kind: 'cash', sb: 1, bb: 2, anteType: 'none', level: undefined }), 1), { sb: 1, bb: 3, ante: 0, level: 2 });
});

test('lock-screen props: clock without breaks, stack in bb, level and next blinds', () => {
  const s = mk({ startedAt: 0, breaks: [{ start: 60 * MIN, end: 75 * MIN }], levelMinutes: 30, levelStartedAt: 100 * MIN });
  const p = liveProps(s, 120 * MIN);
  assert.equal(p.clockFrom, 15 * MIN); // 105 minutes played
  assert.equal(p.played, '1h 45');
  assert.equal(p.paused, false);
  assert.equal(p.pausedAt, 0);
  assert.match(p.stackBB, /^52[.,]5 bb$/);
  assert.equal(p.level, 'Nível 6');
  assert.equal(p.nextLevelAt, 130 * MIN);
  assert.equal(p.title, 'Main Event');
  // Must survive JSON: the native side gets it serialized.
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
});

test('paused session freezes the clock at the pause', () => {
  const s = mk({ breaks: [{ start: 50 * MIN }] });
  const p = liveProps(s, 60 * MIN);
  assert.equal(p.paused, true);
  assert.equal(p.pausedAt, 60 * MIN);
  assert.equal(p.pausedAt - p.clockFrom, 50 * MIN);
});

test('level-up message names the next level and blinds', () => {
  const m = levelUpMessage(mk());
  assert.equal(m.title, 'Subida de nível');
  assert.match(m.body, /Nível 7/);
  assert.match(m.body, /500\/1[\s.,]?000/);
});
