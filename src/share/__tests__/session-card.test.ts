/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sampleHand } from '../../poker/sample';
import type { Session } from '../../store/types';
import { milestoneFor, potInBB, sessionStats, stackPostText, stackStats } from '../session-card';

const H = 3_600_000;
function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: 0, endedAt: 4 * H, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('three numbers: result first, then place and the biggest pot of the session', () => {
  const s = mk({ cashOut: 1340, finish: 12, field: 340 });
  const h = { ...sampleHand('a'), sessionId: 's' };
  const stats = sessionStats(s, [h], false, 4 * H);
  assert.deepEqual(stats.map((x) => x.key), ['result', 'place', 'pot']);
  assert.equal(stats[0].value, '+1240€');
  assert.equal(stats[0].tone, 'good');
  assert.equal(stats[1].value, '12º/340');
  assert.ok(potInBB(h) > 0);
});

test('without money no amount shows anywhere', () => {
  const s = mk({ cashOut: 1340, kind: 'cash' });
  const stats = sessionStats(s, [], true, 4 * H);
  assert.ok(stats.every((x) => !x.value.includes('€')));
  assert.deepEqual(stats.map((x) => x.key), ['hours', 'venue']);
});

test('milestones: round session counts, then best session with history behind it', () => {
  const ten = Array.from({ length: 10 }, (_, i) => mk({ id: 'x' + i, startedAt: i * 10 * H, endedAt: i * 10 * H + H }));
  assert.equal(milestoneFor(ten[9], ten, [])?.kind, 'count');
  assert.equal(milestoneFor(ten[8], ten, []), null);

  const five = [mk({ id: 'a', cashOut: 200 }), mk({ id: 'b', cashOut: 50 }), mk({ id: 'c', cashOut: 0 }), mk({ id: 'd', cashOut: 150 }), mk({ id: 'e', cashOut: 900, startedAt: 5 })];
  const m = milestoneFor(five[4], five, []);
  assert.equal(m?.kind, 'bestResult');
  assert.equal(m?.money, true);
  assert.equal(milestoneFor(five[0], five, []), null);
});

test('best month needs three months of history', () => {
  const month = 31 * 24 * H;
  const list = [mk({ id: 'a', startedAt: 0, cashOut: 50 }), mk({ id: 'b', startedAt: month, cashOut: 120 }), mk({ id: 'c', startedAt: 2 * month, cashOut: 400 })];
  assert.equal(milestoneFor(list[2], list, [])?.kind, 'bestMonth');
  assert.equal(milestoneFor(list[2], list.slice(1), []), null);
});

test('stack card: chips, day and bb while playing; the bag once the day is over; never money or venue', () => {
  const live = mk({ endedAt: undefined, stack: 85000, day: 1, level: 12 });
  const now = 3 * H;
  assert.deepEqual(stackStats(live, now).map((x) => x.key), ['stack', 'day', 'bb']);
  assert.equal(stackStats(live, now)[0].value, '85k');
  const bagged = mk({ stack: 91000, day: 1, bag: { stack: 91000, at: 4 * H } });
  assert.deepEqual(stackStats(bagged, 5 * H).map((x) => x.key), ['stack', 'day', 'hours']);
  assert.equal(stackStats(bagged, 5 * H)[2].label, 'Jogado');
  const text = stackPostText(bagged);
  assert.ok(text.includes('Main') && text.includes('91k'));
  assert.ok(!text.includes('€') && !text.includes('Estoril'));
});

test('mid-day stack text carries the big blinds, never money or the venue', () => {
  const text = stackPostText(mk({ endedAt: undefined, stack: 42000, bb: 1000 }));
  assert.ok(text.includes('42k') && text.includes('42 bb'), text);
  assert.ok(!text.includes('€') && !text.includes('Estoril'));
});
