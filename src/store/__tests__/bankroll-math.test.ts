/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activeFilters,
  applyFilter,
  autoBankrollId,
  balanceCurve,
  balanceOf,
  bankrollOf,
  ensureBankrolls,
  NO_FILTER,
  presetRange,
  scopeOptions,
  sessionsIn,
  sortBankrolls,
  stakeKey,
  stakeOptions,
} from '../bankroll-math';
import { breakdown, curve, totals } from '../session-math';
import type { Bankroll, Session, Transfer } from '../types';

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main', venue: 'Estoril', currency: '€', startedAt: 0, endedAt: 4 * 3600000, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 30000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}
const br = (id: string, currency = '€', createdAt = 1): Bankroll => ({ id, name: id, currency, createdAt });
const tx = (bankrollId: string, kind: Transfer['kind'], amount: number, at = 0): Transfer => ({ id: bankrollId + kind + amount + at, bankrollId, kind, amount, at, note: '' });

test('totals never add euros to dollars', () => {
  const list = [mk({ id: 'a', cashOut: 600 }), mk({ id: 'b', cashOut: 300 }), mk({ id: 'c', currency: '$', cashOut: 10000 })];
  const t = totals(list);
  assert.equal(t.currency, '€');
  assert.equal(t.sessions, 2);
  assert.equal(t.profit, 700);
  assert.deepEqual(t.otherCurrencies, ['$']);
  const usd = totals(list, '$');
  assert.equal(usd.profit, 9900);
  assert.equal(usd.sessions, 1);
  assert.equal(curve(list).at(-1)!.v, 700);
  assert.equal(breakdown(list, 'venue')[0].profit, 700);
});

test('older data gets one bankroll per currency, the player\'s own first', () => {
  const sessions = [mk({ currency: '$' }), mk({ currency: '€' })];
  const made = ensureBankrolls([], sessions, '€', 100);
  assert.deepEqual(made.map((b) => b.currency), ['€', '$']);
  assert.equal(made[0].id, autoBankrollId('€'));
  assert.equal(made[0].name, 'Principal');
  // Nothing missing: same array back, so no save.
  assert.equal(ensureBankrolls(made, sessions, '€'), made);
  // A brand new player still gets one.
  assert.equal(ensureBankrolls([], [], '£').length, 1);
});

test('sessions without a bankroll count towards the first one in their currency', () => {
  const bs = [br('b', '€', 2), br('a', '€', 1), br('u', '$', 3)];
  assert.equal(bankrollOf(mk(), bs)!.id, 'a');
  assert.equal(bankrollOf(mk({ bankrollId: 'b' }), bs)!.id, 'b');
  // A deleted bankroll or a currency mismatch falls back too.
  assert.equal(bankrollOf(mk({ bankrollId: 'gone' }), bs)!.id, 'a');
  assert.equal(bankrollOf(mk({ bankrollId: 'u' }), bs)!.id, 'a');
});

test('balance = deposits − withdrawals + finished results', () => {
  const bs = [br('a'), br('b', '€', 2)];
  const sessions = [mk({ id: '1', cashOut: 400 }), mk({ id: '2', bankrollId: 'b', cashOut: 0 }), mk({ id: 'live', endedAt: undefined, cashOut: 9999 })];
  const transfers = [tx('a', 'deposit', 1000, 1), tx('a', 'withdrawal', 200, 2), tx('b', 'deposit', 500, 3)];
  const a = balanceOf({ bankrollId: 'a' }, sessions, transfers, bs);
  assert.deepEqual(a, { balance: 1100, deposits: 1000, withdrawals: 200, results: 300 });
  const all = balanceOf({ currency: '€' }, sessions, transfers, bs);
  assert.equal(all.balance, 1100 + 400);
  const pts = balanceCurve({ bankrollId: 'a' }, sessions, transfers, bs);
  assert.equal(pts.at(-1)!.v, 1100);
});

test('"All €" appears only for a currency with two or more bankrolls', () => {
  const opts = scopeOptions([br('a'), br('b', '€', 2), br('u', '$', 3)]);
  assert.deepEqual(opts.map((o) => o.label), ['Todas €', 'a', 'b', 'u']);
  assert.equal(sessionsIn({ currency: '$' }, [mk(), mk({ currency: '$' })], [br('a'), br('u', '$')]).length, 1);
});

test('stakes: cash by blinds, tournaments by buy-in band', () => {
  assert.equal(stakeKey(mk({ kind: 'cash', sb: 1, bb: 2 })), 'c:1/2');
  assert.equal(stakeKey(mk({ buyIn: 50 })), 'm:0');
  assert.equal(stakeKey(mk({ buyIn: 51 })), 'm:1');
  assert.equal(stakeKey(mk({ buyIn: 5000 })), 'm:4');
  const opts = stakeOptions([mk({ kind: 'cash', sb: 2, bb: 5 }), mk({ kind: 'cash', sb: 1, bb: 2 }), mk({ buyIn: 550 }), mk({ kind: 'cash', sb: 1, bb: 2 })], '€');
  assert.deepEqual(opts.map((o) => [o.label, o.sessions]), [['1/2', 2], ['2/5', 1], ['501–1500€', 1]]);
});

test('filters combine: game, live/online, stakes and dates', () => {
  const day = 86400000;
  const list = [
    mk({ id: 'live-mtt', startedAt: 10 * day }),
    mk({ id: 'online-mtt', format: 'online', startedAt: 10 * day }),
    mk({ id: 'cash12', kind: 'cash', sb: 1, bb: 2, startedAt: 20 * day }),
    mk({ id: 'cash25', kind: 'cash', sb: 2, bb: 5, startedAt: 30 * day }),
  ];
  const ids = (f: Partial<typeof NO_FILTER>) => applyFilter(list, { ...NO_FILTER, ...f }).map((s) => s.id);
  assert.equal(ids({}).length, 4);
  assert.deepEqual(ids({ format: 'online' }), ['online-mtt']);
  assert.deepEqual(ids({ format: 'live', game: 'mtt' }), ['live-mtt']);
  assert.deepEqual(ids({ stakes: ['c:2/5', 'c:1/2'] }), ['cash12', 'cash25']);
  assert.deepEqual(ids({ range: { from: 15 * day, to: 25 * day } }), ['cash12']);
  assert.equal(activeFilters({ ...NO_FILTER, format: 'live', range: { from: 1 } }), 2);
});

test('date presets', () => {
  const now = new Date(2026, 9, 17, 15).getTime();
  const m = presetRange('month', now);
  assert.equal(m.from, new Date(2026, 9, 1).getTime());
  const lm = presetRange('lastMonth', now);
  assert.equal(lm.from, new Date(2026, 8, 1).getTime());
  assert.equal(lm.to, new Date(2026, 9, 1).getTime() - 1);
  assert.equal(presetRange('year', now).from, new Date(2026, 0, 1).getTime());
  assert.deepEqual(presetRange('all', now), {});
});

test('sortBankrolls: the auto bankroll stays first even when an import brings older ones', () => {
  const auto: Bankroll = { id: autoBankrollId('€'), name: 'Principal', currency: '€', createdAt: 5000 };
  const online: Bankroll = { id: 'br_online', name: 'Online', currency: '€', createdAt: 1000 };
  const later: Bankroll = { id: 'br_later', name: 'Bahamas', currency: '€', createdAt: 3000 };
  assert.deepEqual(sortBankrolls([later, online, auto]).map((b) => b.name), ['Principal', 'Online', 'Bahamas']);
});
