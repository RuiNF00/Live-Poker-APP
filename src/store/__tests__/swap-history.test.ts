/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { swapHistory } from '../swap-history';
import type { SwapGroup } from '../swap-groups';
import type { Swap, SwapEntry, SwapTerms } from '../swaps';
import type { Session } from '../types';

const D = 86400000;
const t0 = 100 * D;
const terms = (over: Partial<SwapTerms> = {}): SwapTerms => ({ v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', a: { name: 'Rui', pct: 5 }, b: { name: 'João', pct: 5 }, note: '', createdAt: t0, ...over });
let n = 0;
const e = (side: 'a' | 'b', amount: number): SwapEntry => ({ id: `e${++n}`, cid: `c${n}`, side, kind: 'result', amount, event: '', finish: null, at: t0 + n });
const swap = (over: Partial<Swap>): Swap => ({ id: `s${++n}`, token: 't', side: 'a', terms: terms(), entries: [], confirmedAt: t0, createdAt: t0, updatedAt: t0, ...over });
const sess = (i: number, cashOut: number, swapNet?: number): Session => ({
  id: `x${i}`, kind: 'mtt', name: '', venue: '', currency: '$', startedAt: t0 + i * 1000, endedAt: t0 + i * 1000 + 500, breaks: [], buyIn: 1000, entries: 1, addOn: 0,
  cashOut, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', swapNet,
});

test('net per partner and per series; nothing until enough prizes', () => {
  const joao = swap({ entries: [e('b', 100000), e('a', 20000)] }); // +5000 − 1000
  const ana = swap({ terms: terms({ b: { name: 'Ana', pct: 5 }, title: 'Vegas' }), entries: [e('a', 10000)] }); // −500
  const unconfirmed = swap({ confirmedAt: undefined, entries: [e('b', 1e6)] });
  const h = swapHistory([joao, ana, unconfirmed], [], []);
  assert.equal(h.prizes, 3);
  assert.equal(h.enough, true);
  assert.deepEqual(h.byPartner.map((x) => [x.label, x.net]), [['João', 4000], ['Ana', -500]]);
  assert.deepEqual(h.bySeries.map((x) => [x.label, x.net]), [['Bahamas', 4000], ['Vegas', -500]]);
  assert.equal(h.total[0].net, 3500);
  assert.equal(swapHistory([ana], [], []).enough, false);
});

test('groups count as one partner line and in the series', () => {
  const g: SwapGroup = {
    id: 'g1', token: 't', seat: 0, terms: { v: 1, scope: 'series', title: 'Bahamas', venue: '', currency: '$', pct: 2, note: '', createdAt: t0 },
    seats: [0, 1, 2].map((seat) => ({ seat, name: `P${seat}`, confirmedAt: t0 })),
    entries: [{ id: 'q', cid: 'q', seat: 1, kind: 'result', amount: 50000, event: '', finish: null, at: t0 }], createdAt: t0, updatedAt: t0,
  };
  const h = swapHistory([], [g], []);
  assert.equal(h.byPartner[0].net, 1000);
  assert.equal(h.bySeries[0].label, 'Bahamas');
});

test('variance: swaps narrow the spread once there are enough tournaments', () => {
  const s = swap({ entries: [e('b', 1)] });
  const few = Array.from({ length: 5 }, (_, i) => sess(i, i % 2 ? 20000 : 0, i % 2 ? -1000 : 500));
  assert.equal(swapHistory([s], [], few).variance, null);
  const many = Array.from({ length: 10 }, (_, i) => sess(i, i % 2 ? 20000 : 0, i % 2 ? -1000 : 500));
  const v = swapHistory([s], [], many).variance!;
  assert.equal(v.sessions, 10);
  assert.ok(v.sdWith < v.sdWithout);
  assert.ok(v.reduction > 0 && v.reduction < 1);
});
