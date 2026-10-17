/// <reference types="node" />
// The year notice on 31 December: scheduled, held by a live session, sent late, once.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../types';
import { planYearRecap, yearNotice, yearSessions } from '../year-recap';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
const DEC31 = at(2026, 11, 31, 18);

test('scheduled for 31 December at 18:00', () => {
  assert.deepEqual(planYearRecap(at(2026, 9, 17), undefined, false), { kind: 'at', at: DEC31, year: 2026 });
  // Sent already this year: nothing.
  assert.deepEqual(planYearRecap(at(2026, 9, 17), 2026, false), { kind: 'none' });
  // A session far from the 31st doesn't hold it.
  assert.equal(planYearRecap(at(2026, 9, 17), undefined, true).kind, 'at');
});

test('a live session holds it; it goes out at the next opening, up to 7 January', () => {
  assert.deepEqual(planYearRecap(at(2026, 11, 31, 15), undefined, true), { kind: 'none', held: true });
  assert.deepEqual(planYearRecap(at(2026, 11, 31, 23), undefined, true), { kind: 'none', held: true });
  assert.deepEqual(planYearRecap(at(2026, 11, 31, 23), undefined, false), { kind: 'now', year: 2026 });
  assert.deepEqual(planYearRecap(at(2027, 0, 3), undefined, false), { kind: 'now', year: 2026 });
  assert.deepEqual(planYearRecap(at(2027, 0, 3), 2026, false), { kind: 'none' });
  // After the 7th: next year's.
  assert.deepEqual(planYearRecap(at(2027, 0, 8), 2026, false), { kind: 'at', at: at(2027, 11, 31, 18), year: 2027 });
});

function s(day: number, hours: number, result: number, currency = '€'): Session {
  const start = at(2026, 4, day, 20);
  return {
    id: 'y' + day, kind: 'cash', name: 'NLH 2/5', venue: 'Casino', currency, startedAt: start, endedAt: start + hours * 3600000, breaks: [],
    buyIn: 500, entries: 1, addOn: 0, cashOut: 500 + result, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '',
  };
}

test('the notice: no amounts unless allowed, and only with 3 sessions', () => {
  assert.equal(yearSessions([s(1, 5, 100), s(2, 5, 100)], 2026), null);
  const list = yearSessions([s(1, 5, 300), s(2, 4, -100), s(3, 6, 1000)], 2026)!;
  const hid = yearNotice(list, 2026, true);
  assert.match(hid.title, /2026/);
  assert.match(hid.body, /^15 h em 3 sessões\./);
  assert.doesNotMatch(hid.body, /€|1200|1 200/);
  assert.match(yearNotice(list, 2026, false).body, /\+1[ .  ]?200€/);
});
