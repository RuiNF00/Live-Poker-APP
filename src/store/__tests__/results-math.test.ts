/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cashStats, drawdown, mttStats, normCdf, project } from '../results-math';
import { breakdown } from '../session-math';
import type { Session } from '../types';

const H = 3600000;
function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: 0, endedAt: 4 * H, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('drawdown: peak, biggest fall and distance below the peak now', () => {
  const d = drawdown([0, 100, 40, 160, 60, 90]);
  assert.equal(d.peak, 160);
  assert.equal(d.max, 100);
  assert.equal(d.current, 70);
  assert.deepEqual(d.peaks, [0, 100, 100, 160, 160, 160]);
  assert.deepEqual(drawdown([]), { peak: 0, max: 0, current: 0, peaks: [] });
});

test('breakdown by any key, with ROI for tournaments', () => {
  const list = [mk({ id: 'a', cashOut: 300 }), mk({ id: 'b' }), mk({ id: 'c', kind: 'cash', buyIn: 200, cashOut: 260, sb: 1, bb: 2 })];
  const rows = breakdown(list, (s) => (s.kind === 'cash' ? `${s.sb}/${s.bb}` : 'MTT'));
  const mtt = rows.find((r) => r.key === 'MTT')!;
  assert.equal(mtt.mtts, 2);
  assert.equal(mtt.roi, 50);
  assert.equal(rows.find((r) => r.key === '1/2')!.roi, null);
});

test('cash stats: per-hour win rate and SD', () => {
  // 3 sessions of 4h: +200, −120, +160 → 240 over 12h = 20/h.
  const list = [200, -120, 160].map((r, i) => mk({ id: String(i), kind: 'cash', buyIn: 200, cashOut: 200 + r }));
  const s = cashStats(list)!;
  assert.equal(s.hourly, 20);
  // Σ(r − 80)² / 12 = (14400 + 40000 + 6400) / 12
  assert.ok(Math.abs(s.sdHour - Math.sqrt(60800 / 12)) < 1e-9);
  assert.equal(cashStats(list.slice(0, 2)), null);
});

test('tournament stats: ROI and SD in buy-ins', () => {
  const list = [0, 0, 0, 0, 600].map((c, i) => mk({ id: String(i), cashOut: c }));
  const s = mttStats(list)!;
  assert.equal(s.roi, 20);
  assert.equal(s.avgBuyIn, 100);
  // results in BI: −1 ×4, +5; mean 0.2, sample SD = sqrt((4·1.44 + 23.04)/4)
  assert.ok(Math.abs(s.sdBuyIns - Math.sqrt((4 * 1.44 + 23.04) / 4)) < 1e-9);
});

test('projection: ranges, chance of losing and the sample needed', () => {
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-4);
  const p = project(20, 100, 100); // mean 2000, sd 1000
  assert.equal(p.mean, 2000);
  assert.equal(p.sd, 1000);
  assert.equal(p.lo95, 2000 - 1960);
  assert.ok(Math.abs(p.pLoss - 0.02275) < 1e-4);
  assert.equal(p.unitsFor95, Math.ceil((1.645 * 100 / 20) ** 2));
  assert.equal(project(-5, 100, 10).unitsFor95, null);
});

test('last results, results per day and the best weekday', async () => {
  const { bestWeekday, dailyResults, lastResults } = await import('../results-math');
  const fri = new Date(2026, 9, 16, 20).getTime(); // a Friday
  const list = [
    mk({ id: 'a', startedAt: fri, endedAt: fri + H, cashOut: 300 }),
    mk({ id: 'b', startedAt: fri + 3 * H, endedAt: fri + 4 * H, cashOut: 0 }),
    mk({ id: 'c', startedAt: fri - 7 * 86400000, endedAt: fri - 7 * 86400000 + H, cashOut: 150 }),
    mk({ id: 'd', startedAt: fri - 86400000, endedAt: fri - 86400000 + H, cashOut: 0 }),
  ];
  assert.deepEqual(lastResults(list, 3), [-100, 200, -100]);
  const day = new Date(2026, 9, 16).getTime();
  assert.equal(dailyResults(list).get(day), 100);
  assert.deepEqual(bestWeekday(list), { day: 5, profit: 150, sessions: 3 });
});

test('verdict: only with enough sample, and only when the rate clears variance', async () => {
  const { verdict } = await import('../results-math');
  const fmt = (n: number) => `${n}€`;
  const mk = (i: number, hours: number, res: number): Session =>
    ({ id: 'v' + i, kind: 'cash', name: '', venue: '', currency: '€', startedAt: i * 86400000, endedAt: i * 86400000 + hours * 3600000, breaks: [], buyIn: 500, entries: 1, addOn: 0, cashOut: 500 + res, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '' }) as Session;
  assert.equal(verdict([mk(1, 5, 100)], '€', fmt).ready, false);
  // 40 sessions × 5 h at a steady ~30/h: a clear winner.
  const steady = Array.from({ length: 40 }, (_, i) => mk(i, 5, i % 2 ? 140 : 160));
  const v = verdict(steady, '€', fmt);
  assert.equal(v.ready, true);
  assert.equal(v.tone, 'good');
  assert.match(v.text, /30€\/h/);
  // Same win rate, huge swings: still inside variance.
  const swingy = Array.from({ length: 40 }, (_, i) => mk(i, 5, i % 2 ? 2150 : -1850));
  assert.equal(verdict(swingy, '€', fmt).tone, 'neutral');
});
