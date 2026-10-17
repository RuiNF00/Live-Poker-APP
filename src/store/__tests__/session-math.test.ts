/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { breakdown, owedToBackers, parseDay, profit, totals } from '../session-math';
import type { Session } from '../types';

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: 0, endedAt: 4 * 3600000, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('no staking: profit is prize minus buy-ins minus expenses', () => {
  assert.equal(profit(mk({ cashOut: 500, entries: 2 })), 300);
  assert.equal(profit(mk({ cashOut: 500, expenses: 50 })), 350);
});

test('50% sold at 1.2 markup', () => {
  const s = mk({ buyIn: 1000, cashOut: 10000, staking: { sold: 50, markup: 1.2 } });
  // Backers paid 600, get 5000. You: 10000 - 5000 - (1000 - 600) = 4600.
  assert.equal(owedToBackers(s), 5000);
  assert.equal(profit(s), 4600);
  // Bust: you only lose your own 400.
  assert.equal(profit({ ...s, cashOut: 0 }), -400);
});

test('totals ROI uses your own money', () => {
  const s = mk({ buyIn: 1000, cashOut: 0, staking: { sold: 50, markup: 1 } });
  const t = totals([s]);
  assert.equal(t.invested, 500);
  assert.equal(t.roi, -100);
});

test('breakdown groups by venue, case-insensitive, skips blanks and live sessions', () => {
  const list = [
    mk({ id: 'a', venue: 'Estoril', cashOut: 300 }),
    mk({ id: 'b', venue: 'estoril', cashOut: 0 }),
    mk({ id: 'c', venue: 'Lisboa', cashOut: 0 }),
    mk({ id: 'd', venue: '', cashOut: 900 }),
    mk({ id: 'e', venue: 'Lisboa', endedAt: undefined }),
  ];
  const b = breakdown(list, 'venue');
  assert.deepEqual(b.map((x) => [x.key, x.sessions, x.profit]), [['Estoril', 2, 100], ['Lisboa', 1, -100]]);
  assert.equal(b[0].hours, 8);
});

test('parseDay reads dd/mm[/yyyy] and refuses the future', () => {
  const now = new Date(2026, 9, 17, 12).getTime();
  assert.equal(parseDay('3/10', now), new Date(2026, 9, 3).getTime());
  assert.equal(parseDay('03-10-25', now), new Date(2025, 9, 3).getTime());
  assert.equal(parseDay('20/12', now), new Date(2025, 11, 20).getTime());
  assert.equal(parseDay('31/02/2026', now), null);
  assert.equal(parseDay('1/1/2030', now), null);
  assert.equal(parseDay('ontem', now), null);
});
