/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../../store/types';
import { importRecap } from '../recap';

const H = 3_600_000;
let n = 0;
function mk(y: number, cashOut: number, over: Partial<Session> = {}, hours = 4): Session {
  const startedAt = new Date(y, 4, 1 + (n % 20), 20).getTime();
  return {
    id: 'r' + n++, kind: 'cash', name: '', venue: 'Estoril', currency: '€', startedAt, endedAt: startedAt + hours * H, breaks: [], buyIn: 500, entries: 1, addOn: 0, cashOut,
    sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', ...over,
  };
}

test('counts what came in and finds the best year', () => {
  const list = [mk(2023, 400), mk(2023, 300), mk(2023, 900), mk(2024, 2500), mk(2024, 1200), mk(2024, 800, { venue: 'Casino Lisboa' }), mk(2025, 3000)];
  const r = importRecap(list, list);
  assert.equal(r.sessions, 7);
  assert.equal(r.hours, 28);
  assert.equal(r.venues, 2);
  assert.deepEqual([r.from, r.to], [2023, 2025]);
  // 2025 made the most but has one session: not a year to call the best.
  assert.equal(r.best?.year, 2024);
  assert.equal(r.best?.profit, 3000);
  assert.equal(r.best?.byHours, false);
});

test('a losing history names the year played most instead', () => {
  const list = [mk(2022, 0), mk(2022, 0), mk(2022, 0), mk(2023, 0, {}, 9), mk(2023, 0), mk(2023, 0)];
  const r = importRecap(list, list);
  assert.equal(r.best?.year, 2023);
  assert.equal(r.best?.byHours, true);
});

test('sessions already in the app count towards the best year', () => {
  const before = [mk(2024, 1000), mk(2024, 1000)];
  const imported = [mk(2024, 900)];
  assert.equal(importRecap(imported, [...before, ...imported]).best?.year, 2024);
  assert.equal(importRecap(imported, imported).best, null);
});
