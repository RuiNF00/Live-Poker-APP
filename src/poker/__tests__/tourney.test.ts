/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { levelAfter, nextLevelAt, withLevelClock } from '../../lib/lock-screen/live-state';
import type { Session } from '../../store/types';
import { averageStack, nextBreak, num, parsePayouts, parseStructure, payState, stackDepth, syncTo, templateStructure } from '../tourney';

const MIN = 60_000;

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: '', currency: '$', startedAt: 0, breaks: [],
    buyIn: 1000, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', level: 1, tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('structure typed or pasted: blinds, ante and length in the usual shapes', () => {
  const s = parseStructure(['Level  SB/BB  Ante  Min', '1  100/200  200  40', '2  200/300 300', 'BREAK 15', '3 200-400 (400) 40m', '4 1k/2k/2k 60', '5 1,500/3,000/3,000'].join('\n'));
  assert.deepEqual(s, [
    { sb: 100, bb: 200, ante: 200, minutes: 40 },
    // A missing length repeats the one before; 300 is the ante, not a length past 120.
    { sb: 200, bb: 300, ante: 300, minutes: 40, breakAfter: 15 },
    { sb: 200, bb: 400, ante: 400, minutes: 40 },
    { sb: 1000, bb: 2000, ante: 2000, minutes: 60 },
    { sb: 1500, bb: 3000, ante: 3000, minutes: 60 },
  ]);
  assert.deepEqual(parseStructure('nothing here\n\n'), []);
  assert.equal(templateStructure(30)[0].ante, 200);
});

test('numbers: thousands by dot, comma or space; decimals; k', () => {
  assert.equal(num('250.000'), 250000);
  assert.equal(num('250,000'), 250000);
  assert.equal(num('1.5k'), 1500);
  assert.equal(num('2,5k'), 2500);
  assert.equal(num('1.000.000'), 1000000);
  assert.equal(num('26.5'), 26.5);
});

test('payouts: places, ranges and holes', () => {
  assert.deepEqual(parsePayouts('1 250,000\n2: 150000\n3rd $90,000\n4-5 50,000'), [250000, 150000, 90000, 50000, 50000]);
  // Place 3 not listed: pays what the place below pays.
  assert.deepEqual(parsePayouts('1 100\n2 60\n4 30'), [100, 60, 30, 30]);
  assert.deepEqual(parsePayouts('Total 1,000,000'), []);
  // pt-PT: the dot groups thousands.
  assert.deepEqual(parsePayouts('1 250.000\n2 150.000 €\n3-4 90 000'), [250000, 150000, 90000, 90000]);
  assert.deepEqual(parsePayouts('1º 26.000€'), [26000]);
  assert.deepEqual(parsePayouts('1 - 1.000.000 €'), [1000000]);
  assert.deepEqual(parsePayouts('Place 1: 5000\nLugar 2: 3000'), [5000, 3000]);
});

test('pay jumps: bubble, min-cash and the next jump', () => {
  const p = [1000, 600, 400, 300, 200, 200, 200, 150, 150, 150];
  assert.deepEqual(payState(p, 14), { paid: 10, toMoney: 4, now: 0, next: 150, toNext: 4 });
  // In the money at 10th: 8th-10th pay the same, so the next jump is 7th.
  assert.deepEqual(payState(p, 10), { paid: 10, toMoney: 0, now: 150, next: 200, toNext: 3 });
  assert.deepEqual(payState(p, 2), { paid: 10, toMoney: 0, now: 600, next: 1000, toNext: 1 });
  assert.equal(payState(p, 1)?.next, null);
  assert.equal(payState([], 5), null);
});

test('stack depth in BB and M, average stack', () => {
  const d = stackDepth(30000, { sb: 100, bb: 200, ante: 200, anteType: 'bb' }, 9);
  assert.equal(d.bb, 150);
  assert.equal(d.m, 60);
  // Antes from every player count once per seat.
  assert.equal(stackDepth(9000, { sb: 100, bb: 200, ante: 25, anteType: 'all' }, 8).m, 18);
  assert.equal(averageStack({ entries: 300, left: 100, startStack: 50000 }), 150000);
  assert.equal(averageStack({ entries: 300, startStack: 50000 }), null);
});

test('one-tap sync: level and minutes left on the floor clock', () => {
  const st = parseStructure('100/200/200 40\n200/400/400 40\n300/600/600 60');
  const now = 100 * MIN;
  const p = syncTo(st, 3, 22, now);
  assert.deepEqual(p, { sb: 300, bb: 600, ante: 600, level: 3, levelMinutes: 60, levelStartedAt: now - 38 * MIN });
  const prev = mk({ levelMinutes: 40, levelStartedAt: 80 * MIN, tourney: { structure: st } });
  const next = withLevelClock(prev, { ...prev, ...p }, now);
  // The synced start survives the level change, so the clock shows 22 minutes left.
  assert.equal(nextLevelAt(next, now), now + 22 * MIN);
  // Past the end clamps to the last level; no minutes means a fresh level.
  assert.equal(syncTo(st, 9, undefined, now).level, 3);
  assert.equal(syncTo(st, 1, undefined, now).levelStartedAt, now);
});

test('level up follows the entered structure, with its length', () => {
  const st = parseStructure('100/200/200 40\n200/400/400 40\n300/600/600 60');
  const s = mk({ level: 2, tourney: { structure: st } });
  assert.deepEqual(levelAfter(s, 1), { sb: 300, bb: 600, ante: 600, level: 3, levelMinutes: 60 });
  assert.equal(levelAfter({ ...s, level: 3 }, 1).level, 3);
  // Without a structure, the old ladder.
  assert.equal(levelAfter(mk({ level: 1 }), 1).bb, 300);
});

test('breaks: pasted in their own line, in the templates, and the next one timed from the level clock', () => {
  const s = parseStructure(['100/200/200 30', '200/400/400 30', 'Intervalo (20\')', '300/600/600 30', 'Dinner break', '400/800/800 30', 'BREAK - 10 min'].join('\n'));
  assert.deepEqual(
    s.map((l) => l.breakAfter),
    [undefined, 20, 15, 10],
  );
  // A break line before any level has nothing to follow.
  assert.equal(parseStructure('Break 15\n100/200 30')[0].breakAfter, undefined);
  // Templates: about every two hours of play.
  const std = templateStructure(30);
  assert.deepEqual(std.slice(0, 8).map((l) => !!l.breakAfter), [false, false, false, true, false, false, false, true]);
  assert.equal(templateStructure(60)[1].breakAfter, 15);
  const M = 60_000;
  // On level 1 ending at 0: levels 2 (30 min) then the break.
  assert.deepEqual(nextBreak(s, 1, 0), { afterLevel: 2, at: 30 * M, minutes: 20 });
  // On level 2: the break comes when it ends.
  assert.deepEqual(nextBreak(s, 2, 5 * M), { afterLevel: 2, at: 5 * M, minutes: 20 });
  assert.equal(nextBreak(templateStructure(30).map(({ breakAfter: _, ...l }) => l), 1, 0), null);
  assert.equal(nextBreak(undefined, 1, 0), null);
});
