/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decimalComma } from '../../i18n';

import {
  activeFilters,
  applyFilter,
  autoBankrollId,
  balanceCurve,
  balanceOf,
  bankrollOf,
  endOfDay,
  ensureBankrolls,
  separateBankrolls,
  NO_FILTER,
  presetRange,
  scopeOptions,
  sessionsIn,
  sortBankrolls,
  stakeKey,
  stakeLabel,
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

test('a bankroll already holding a currency\'s id in another currency is never written over', () => {
  // The onboarding of older builds moved the first "Principal" to dollars and kept the euro id.
  const principal: Bankroll = { ...br(autoBankrollId('€'), '$'), name: 'Principal', updatedAt: 5 };
  const made = ensureBankrolls([principal], [mk({ currency: '€', cashOut: 250 })], '$', 100);
  assert.equal(made.length, 2);
  assert.equal(made[0], principal);
  assert.equal(made[1].currency, '€');
  assert.equal(made[1].id, autoBankrollId('€') + '_2');
  assert.equal(new Set(made.map((b) => b.id)).size, 2);
  // The same id on every phone, and the € session counts in euros, not in the dollar Principal.
  assert.equal(ensureBankrolls([principal], [mk({ currency: '€' })], '$', 7)[1].id, made[1].id);
  assert.equal(bankrollOf(mk({ currency: '€', bankrollId: principal.id }), made)!.id, made[1].id);
  // Two bankrolls with one id (what that left behind) become one, the first, and the € one comes back.
  const twice = ensureBankrolls([principal, { ...br(autoBankrollId('€'), '€'), name: 'Bankroll €' }], [mk({ currency: '€' })], '$', 100);
  assert.deepEqual(twice.map((b) => [b.id, b.currency]), [[principal.id, '$'], [autoBankrollId('€') + '_2', '€']]);
});

test('a backup bankroll under an id held here in another currency gets its own id, with its money', () => {
  const here: Bankroll = { ...br(autoBankrollId('€'), '$'), name: 'Principal', updatedAt: 9 };
  const theirs: Bankroll = { ...br(autoBankrollId('€'), '€'), name: 'Principal', updatedAt: 20 };
  const backup = {
    bankrolls: [theirs],
    sessions: [mk({ id: 'e', currency: '€', bankrollId: theirs.id, cashOut: 300 }), mk({ id: 'd', currency: '$', bankrollId: theirs.id })],
    transfers: [tx(theirs.id, 'deposit', 500)],
  };
  const out = separateBankrolls([here], backup);
  const id = autoBankrollId('€') + '_2';
  assert.deepEqual(out.bankrolls!.map((b) => [b.id, b.currency, b.name]), [[id, '€', 'Principal']]);
  assert.equal(out.sessions[0].bankrollId, id);
  // A $ session pointing at that id is this phone's $ bankroll's.
  assert.equal(out.sessions[1].bankrollId, here.id);
  assert.equal(out.transfers![0].bankrollId, id);
  // Two bankrolls, each currency's balance as it was: the $ one keeps none of the € deposit.
  const all = [here, ...out.bankrolls!];
  assert.equal(balanceOf({ bankrollId: here.id }, out.sessions, out.transfers!, all).balance, -100);
  assert.equal(balanceOf({ bankrollId: id }, out.sessions, out.transfers!, all).balance, 700);
  // Nothing in common: the same backup back.
  assert.equal(separateBankrolls([br('x', '$')], backup), backup);
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

test('restoring on a fresh phone: its own empty "Principal" gives way to the backup\'s', async () => {
  const { dropUnusedAuto, ensureBankrolls } = await import('../bankroll-math');
  const { mergeById } = await import('../backup');
  // Fresh install in dollars; the backup is a euro player with a renamed-id Principal.
  const fresh = ensureBankrolls([], [], '$', 1);
  const backup: Bankroll[] = [{ id: 'br_old', name: 'Principal', currency: '€', createdAt: 0, updatedAt: 5 }];
  const merged = mergeById(fresh, backup).list;
  assert.equal(merged.length, 2);
  assert.deepEqual(dropUnusedAuto(merged, backup, { bankrolls: fresh, sessions: [], transfers: [] }).map((b) => b.id), ['br_old']);
  // Same currency, same stable id: merged by id, nothing dropped.
  const eur = ensureBankrolls([], [], '€', 1);
  const same = mergeById(eur, [{ ...eur[0], updatedAt: 9 }]).list;
  assert.equal(dropUnusedAuto(same, [{ ...eur[0], updatedAt: 9 }], { bankrolls: eur, sessions: [], transfers: [] }).length, 1);
  // A phone already in use keeps its own.
  const used = dropUnusedAuto(merged, backup, { bankrolls: fresh, sessions: [], transfers: [{ id: 't', bankrollId: fresh[0].id, kind: 'deposit', amount: 1, at: 1, note: '' }] });
  assert.equal(used.length, 2);
  // Nothing in the backup: nothing changes.
  assert.equal(dropUnusedAuto(fresh, [], { bankrolls: fresh, sessions: [], transfers: [] }), fresh);
});

test('restoring after the onboarding currency pick: one "Principal", not two (QA)', async () => {
  const { autoBankrollId, dropUnusedAuto, ensureBankrolls } = await import('../bankroll-math');
  const { mergeById } = await import('../backup');
  // First launch makes a € Principal; the onboarding picks $ (saved: it has an edit time).
  const picked = ensureBankrolls([], [], '€', 1).map((b) => ({ ...b, currency: '$', updatedAt: 7 }));
  const backup: Bankroll[] = [{ id: autoBankrollId('$'), name: 'Principal', currency: '$', createdAt: 0, updatedAt: 0 }];
  const merged = mergeById(picked, backup).list;
  assert.deepEqual(dropUnusedAuto(merged, backup, { bankrolls: picked, sessions: [], transfers: [] }).map((b) => b.id), [autoBankrollId('$')]);
  // Renamed or given rules after the pick: the player's own, it stays.
  const renamed = picked.map((b) => ({ ...b, name: 'Casino' }));
  assert.equal(dropUnusedAuto(mergeById(renamed, backup).list, backup, { bankrolls: renamed, sessions: [], transfers: [] }).length, 2);
});

test('bankrollsBack: a restore on a fresh phone counts the backup\'s Principal too', async () => {
  const { bankrollsBack, ensureBankrolls } = await import('../bankroll-math');
  const fresh = ensureBankrolls([], [], '€', 1);
  const backup: Bankroll[] = [{ ...fresh[0], name: 'Casino', updatedAt: 5 }, { id: 'br_live', name: 'Live', currency: '€', createdAt: 2, updatedAt: 3 }];
  // Same stable id as the phone's empty Principal, plus a new one: both come back.
  assert.equal(bankrollsBack(backup, { bankrolls: fresh, sessions: [], transfers: [] }), 2);
  // A Principal already in use here stays the player's own: only the new one counts.
  const tx = [{ id: 't', bankrollId: fresh[0].id, kind: 'deposit' as const, amount: 1, at: 1, note: '' }];
  assert.equal(bankrollsBack(backup, { bankrolls: fresh, sessions: [], transfers: tx }), 1);
  assert.equal(bankrollsBack([], { bankrolls: fresh, sessions: [], transfers: [] }), 0);
});

test('stakeLabel: blinds with cents read as money, whole blinds stay plain', () => {
  const sep = decimalComma ? ',' : '.';
  assert.equal(stakeLabel(stakeKey({ kind: 'cash', sb: 0.25, bb: 0.5, buyIn: 50 }), '€'), `0${sep}25/0${sep}50`);
  assert.equal(stakeLabel(stakeKey({ kind: 'cash', sb: 1, bb: 2, buyIn: 200 }), '€'), '1/2');
});

// Meaningful in any time zone; checked by hand with TZ=Europe/Lisbon and TZ=America/Los_Angeles.
test('endOfDay and the 30-day range follow the calendar across DST changes', () => {
  for (const [y, m, d] of [[2026, 9, 25], [2026, 10, 1], [2026, 2, 29], [2026, 2, 8]]) {
    assert.equal(endOfDay(new Date(y, m, d, 12).getTime()), new Date(y, m, d, 23, 59, 59, 999).getTime());
  }
  assert.equal(presetRange('30d', new Date(2026, 9, 26, 0, 30).getTime()).from, new Date(2026, 8, 27).getTime());
  assert.equal(presetRange('30d', new Date(2026, 2, 29, 23, 30).getTime()).from, new Date(2026, 1, 28).getTime());
});
