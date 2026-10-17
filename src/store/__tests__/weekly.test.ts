/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../types';
import { roundedClock, todayAt, weeklyFrom, weeklyMatch, weeklyToday } from '../weekly';

// Thursday 22 Oct 2026, 21:10 on the phone's clock.
const thu = new Date(2026, 9, 22, 21, 10).getTime();
const s = { name: ' Torneio de quinta ', venue: 'Casino da cidade', currency: '€', buyIn: 60, stack: 30000, levelMinutes: 20 } as Session;

test('weekly: saved from the form on today\'s weekday, matched by name and buy-in', () => {
  const w = weeklyFrom('w1', s, '21:00', thu);
  assert.deepEqual(w, { id: 'w1', name: 'Torneio de quinta', venue: 'Casino da cidade', currency: '€', weekday: 4, time: '21:00', buyIn: 60, stack: 30000, levelMinutes: 20 });
  assert.equal(weeklyMatch([w], s, thu)?.id, 'w1');
  assert.equal(weeklyMatch([w], { ...s, buyIn: 100 }, thu), undefined);
  // Next Thursday it's there; on Friday it isn't.
  const week = 7 * 86_400_000;
  assert.deepEqual(weeklyToday([w], thu + week).map((x) => x.id), ['w1']);
  assert.deepEqual(weeklyToday([w], thu + 86_400_000), []);
});

test('weekly: start time defaults to the hour or half hour, today at that time', () => {
  assert.equal(roundedClock(thu), '21:00');
  assert.equal(roundedClock(new Date(2026, 9, 22, 20, 45).getTime()), '20:30');
  assert.equal(todayAt('21:00', thu), new Date(2026, 9, 22, 21, 0).getTime());
});
