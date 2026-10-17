/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Bankroll, Session } from '../../store/types';
import { currenciesOf, defaultPlacement, NEW, place } from '../bankrolls';
import type { ImportedMove } from '../convert';

const s = (id: string, currency: string) => ({ id, currency }) as Session;
const m = (id: string, currency: string): ImportedMove => ({ id, kind: 'deposit', amount: 100, at: 1, currency, note: '' });
const main: Bankroll = { id: 'b1', name: 'Principal', currency: '€', createdAt: 1 };
const trip: Bankroll = { id: 'b2', name: 'Viagem', currency: '€', createdAt: 2 };

test('every currency goes to a bankroll in that currency', () => {
  const cur = currenciesOf([s('a', '$'), s('b', '€')], [m('x', '£')], '€');
  assert.deepEqual(cur, ['€', '$', '£']);
  const p = defaultPlacement(cur, [main, trip], trip);
  assert.deepEqual(p, { '€': 'b2', $: NEW, '£': NEW });
  const r = place({ sessions: [s('a', '$'), s('b', '€')], moves: [m('x', '£')] }, p, { source: 'pbt', appName: 'PBT', bankrolls: [main, trip], now: 10 });
  assert.equal(r.sessions[1].bankrollId, 'b2');
  assert.equal(r.bankrolls.length, 2);
  assert.deepEqual(r.bankrolls.map((b) => [b.name, b.currency]), [['PBT $', '$'], ['PBT £', '£']]);
  assert.equal(r.sessions[0].bankrollId, r.bankrolls[0].id);
  assert.equal(r.transfers[0].bankrollId, r.bankrolls[1].id);
});

test('a second import reuses the bankroll the first one made', () => {
  const first = place({ sessions: [s('a', '€')], moves: [] }, { '€': NEW }, { source: 'pbt', appName: 'PBT', bankrolls: [main] });
  const again = place({ sessions: [s('b', '€')], moves: [] }, { '€': NEW }, { source: 'pbt', appName: 'PBT', bankrolls: [main, ...first.bankrolls] });
  assert.equal(again.bankrolls.length, 0);
  assert.equal(again.sessions[0].bankrollId, first.bankrolls[0].id);
});

test('a bankroll in the wrong currency is never used', () => {
  const r = place({ sessions: [s('a', '$')], moves: [] }, { $: 'b1' }, { source: 'csv', appName: 'CSV', bankrolls: [main] });
  assert.notEqual(r.sessions[0].bankrollId, 'b1');
  assert.equal(r.bankrolls[0].currency, '$');
});
