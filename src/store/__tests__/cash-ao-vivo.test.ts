/// <reference types="node" />
// A long live cash night as it is played: a buy-in, a top-up of another size, moving up from
// 1/2 to 2/5 halfway, a session that runs past midnight and a stop-loss for the day.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { levelAfter, levelUpMessage } from '../../lib/lock-screen/live-state';
import { stopLoss, DEFAULT_RULES } from '../rules-math';
import { cost, endCashOut, profit, rebuyPatch } from '../session-math';
import type { Session } from '../types';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

function cash(over: Partial<Session> = {}): Session {
  return {
    id: 'c', kind: 'cash', name: 'NLH 1/2', venue: 'Casino Lisboa', currency: '€', startedAt: at(17, 21), breaks: [],
    buyIn: 200, entries: 1, addOn: 0, cashOut: 0, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 200,
    stackLog: [{ t: at(17, 21), stack: 200 }], roster: [], notes: '',
    ...over,
  };
}

test('rebuys of any size: the usual buy-in is an entry, another amount a top-up, both on the stack', () => {
  let s = cash({ stack: 40 });
  s = { ...s, ...rebuyPatch(s, 200, at(17, 22)) };
  assert.deepEqual([s.entries, s.addOn, s.stack], [2, 0, 240]);
  // Moved up to 2/5 and topped up with 300 (a rebuy was always the 200 of the first buy-in).
  const moved = { ...s, sb: 2, bb: 5 };
  s = { ...moved, ...rebuyPatch(moved, 300, at(17, 23, 30)) };
  assert.deepEqual([s.entries, s.addOn, s.stack], [2, 300, 540]);
  assert.equal(cost(s), 700);
  assert.equal(s.stackLog.at(-1)!.stack, 540);
  // Cashes out 1 150 at 03:00: the end form starts at the live stack.
  const done = { ...s, stack: 1150, cashOut: endCashOut({ cashOut: null, bounties: 0, place: 0, field: 0, tips: 0, handsDealt: 0 }, { ...s, stack: 1150 }), endedAt: at(18, 3) };
  assert.equal(profit(done), 450);
  // A tournament re-entry is always one more entry, from a fresh stack.
  const m = cash({ kind: 'mtt', buyIn: 250, stack: 0 });
  assert.deepEqual(rebuyPatch(m, 250, 0, 30000), { entries: 2, stack: 30000, stackLog: [...m.stackLog, { t: 0, stack: 30000, level: undefined }] });
});

test('moving stakes in cash: no level number, and blinds off the ladder step to the next stake', () => {
  // 1/2 up is 1/3, with no «Nível 2» on the card (it showed one).
  assert.deepEqual(levelAfter(cash(), 1), { sb: 1, bb: 3, ante: 0, level: undefined });
  // 2/4 is not on the ladder: up went to 1/3 (down a stake); now 2/5, and down 2/3.
  assert.deepEqual(levelAfter(cash({ sb: 2, bb: 4 }), 1), { sb: 2, bb: 5, ante: 0, level: undefined });
  assert.deepEqual(levelAfter(cash({ sb: 2, bb: 4 }), -1), { sb: 2, bb: 3, ante: 0, level: undefined });
  // A tournament at 150/300 without a structure: up is the next bigger big blind.
  const up = levelAfter(cash({ kind: 'mtt', sb: 150, bb: 300, ante: 300, anteType: 'bb', level: 3 }), 1);
  assert.ok(up.bb > 300 && up.level === 4, JSON.stringify(up));
  // The cash reminder names the blinds, never «Nível undefined».
  assert.doesNotMatch(levelUpMessage(cash({ sb: 2, bb: 5 })).body, /undefined|Nível/);
});

test('a daily stop-loss holds through midnight: a night at the casino is one day', () => {
  const r = { ...DEFAULT_RULES, stopLoss: 1000, stopLossPer: 'day' as const };
  // Lost 600 from 19:00 to 23:30, then sat at another table at 23:45.
  const first = cash({ id: 'a', startedAt: at(17, 19), endedAt: at(17, 23, 30), buyIn: 600, cashOut: 0 });
  const live = cash({ id: 'b', startedAt: at(17, 23, 45), buyIn: 500, stack: 150 });
  // At 02:00 the day's loss is 600 + 350 (midnight dropped the first session: 350).
  assert.equal(stopLoss(r, [first, live], live, at(18, 2))!.lost, 950);
  assert.equal(stopLoss(r, [first, live], live, at(18, 2))!.near, true);
  // A session sat at 03:30 after that night is still that night's day.
  const after = cash({ id: 'c', startedAt: at(18, 3, 30), buyIn: 200, stack: 100 });
  assert.equal(stopLoss(r, [first, { ...live, endedAt: at(18, 3), cashOut: 150 }, after], after, at(18, 4))!.lost, 1050);
  // The next afternoon is a new day.
  const next = cash({ id: 'd', startedAt: at(18, 16), buyIn: 200, stack: 100 });
  assert.equal(stopLoss(r, [first, { ...live, endedAt: at(18, 3), cashOut: 150 }, next], next, at(18, 17))!.lost, 100);
  // Per session, as before: only the live one.
  assert.equal(stopLoss({ ...r, stopLossPer: 'session' }, [first, live], live, at(18, 2))!.lost, 350);
});
