/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReport } from '../../export/report';
import { yearReview } from '../../share/year-review';
import { monthRecap } from '../month-recap';
import { breakdown, totals } from '../session-math';
import type { Session } from '../types';

let n = 0;
const H = 3600000;
const at = new Date(2026, 8, 10, 20).getTime();
function mk(over: Partial<Session>): Session {
  n++;
  return {
    id: 's' + n, kind: 'cash', name: 'NL', venue: 'Estoril', currency: '€', startedAt: at, endedAt: at, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 100, sb: 1, bb: 2, ante: 0, anteType: 'bb', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '',
    ...over,
  } as Session;
}

test('imported sessions with no hours count in the profit, never in €/h (Pesquisa)', () => {
  const timed = mk({ cashOut: 200, endedAt: at + 4 * H }); // +100 in 4 h: 25 €/h
  const untimed = mk({ cashOut: 1100 }); // +1000, no hours
  const list = [timed, untimed];
  const t = totals(list, '€');
  assert.equal(t.profit, 1100);
  assert.equal(t.hours, 4);
  assert.equal(t.hourly, 25, 'not 275 €/h');
  const [b] = breakdown(list, 'venue', '€');
  assert.equal(b.profit, 1100);
  assert.equal(b.hourly, 25);
  const m = monthRecap(list, '2026-09', '€');
  assert.equal(m.profit, 1100);
  assert.equal(m.hourly, 25);
  // Only untimed: no rate at all.
  assert.equal(totals([untimed], '€').hourly, 0);
});

test('the report and the year card say the same €/h (Staking, Replayer and Importar P2)', () => {
  const timed = mk({ cashOut: 200, endedAt: at + 4 * H });
  const untimed = mk({ cashOut: 1100 });
  const list = [timed, untimed];
  const r = buildReport({ sessions: list, transfers: [], bankrolls: [], range: { from: 0, to: Number.MAX_SAFE_INTEGER } } as never);
  const c = r.currencies[0];
  for (const rows of [c.byFormat, c.byMonth]) {
    assert.equal(rows[0].profit, 1100);
    assert.equal(rows[0].hourly, 25);
  }
  const y = yearReview(2026, list, []);
  assert.equal(y.profit, 1100);
  assert.equal(y.hourly, 25);
  // Per stake too: two timed sessions and one with no hours at the same stake.
  const stake = [mk({ cashOut: 200, endedAt: at + 4 * H }), mk({ cashOut: 200, endedAt: at + 4 * H }), mk({ cashOut: 1100 })];
  const row = yearReview(2026, stake, []).bestStake!;
  assert.equal(row.hourly, 25);
  assert.equal(row.bbPerHour, 12.5);
});
