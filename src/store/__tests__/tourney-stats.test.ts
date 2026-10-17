/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { profit, totals } from '../session-math';
import { bandOf, biggestScores, finishedTourneys, gameOf, groupBy, summarize, tripOf } from '../tourney-stats';
import type { Session, Trip } from '../types';

let n = 0;
function mtt(over: Partial<Session> = {}): Session {
  n++;
  return {
    id: 'm' + n, kind: 'mtt', name: 'Main Event', venue: 'Baha Mar', currency: '$', startedAt: n * 86400000, endedAt: n * 86400000 + 3600000, breaks: [],
    buyIn: 1000, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 0,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('games and buy-in bands from what the player typed', () => {
  assert.equal(gameOf('#12 Super Main Event'), 'NLH');
  assert.equal(gameOf('PLO High Roller'), 'PLO');
  assert.equal(gameOf('Pot-Limit Omaha 8'), 'PLO');
  assert.equal(gameOf('8-Game Mix'), 'Mix');
  assert.equal(gameOf('H.O.R.S.E.'), 'Mix');
  assert.equal(gameOf('Mixed Championship'), 'Mix');
  assert.equal(bandOf(500), '< 1k');
  assert.equal(bandOf(1000), '1k–3k');
  assert.equal(bandOf(5300), '3k–10k');
  assert.equal(bandOf(26000), '25k+');
});

test('only finished, unbagged tournaments in one currency count', () => {
  const list = [mtt(), mtt({ endedAt: undefined }), mtt({ bag: { stack: 50000, at: 1 } }), mtt({ currency: '€' }), mtt({ kind: 'cash' })];
  const r = finishedTourneys(list, '$');
  assert.equal(r.list.length, 1);
});

test('"mine" matches the Bankroll totals; "action" is buy-ins against prizes', () => {
  const list = [
    mtt({ entries: 2, cashOut: 0 }),
    mtt({ cashOut: 5000, finish: 8, field: 400, stakes: [{ share: 50, markup: 1.2 }] }),
    mtt({ cashOut: 0, expenses: 200, finish: 120, field: 400 }),
  ];
  const mine = summarize(list, 'mine');
  const t = totals(list, '$');
  assert.equal(Math.round(mine.net), Math.round(list.reduce((a, s) => a + profit(s), 0)));
  assert.equal(Math.round(mine.roi!), Math.round(t.roi!));
  const action = summarize(list, 'action');
  assert.equal(action.invested, 4000);
  assert.equal(action.net, 1000);
  assert.equal(action.roi, 25);
  assert.equal(Math.round(action.itm!), 33);
  assert.equal(action.avgFinish, 64);
  assert.equal(action.avgFieldPct, 16);
  assert.equal(Math.round(action.reentryRate!), 33);
  assert.equal(action.entries, 4);
});

test('bounties are part of the prize: alone they are not a cash, and backers own their share', () => {
  const ko = mtt({ cashOut: 1500, tourney: { bounties: 1500 } });
  const deep = mtt({ cashOut: 9000, tourney: { bounties: 2000 }, stakes: [{ share: 50, markup: 1 }] });
  const a = summarize([ko, deep], 'action');
  assert.equal(a.itm, 50);
  assert.equal(a.bounties, 3500);
  assert.equal(summarize([ko, deep], 'mine').bounties, 2500);
});

test('groups in band order, festivals by trip, biggest scores', () => {
  const list = [mtt({ buyIn: 10000, cashOut: 60000, name: 'High Roller' }), mtt({ buyIn: 500 }), mtt({ buyIn: 2750, cashOut: 4000 })];
  const g = groupBy(list, 'action', (s) => bandOf(s.buyIn), ['< 1k', '1k–3k', '3k–10k', '10k–25k', '25k+']);
  assert.deepEqual(g.map((x) => x.key), ['< 1k', '1k–3k', '10k–25k']);
  const trip = { id: 't', from: list[0].startedAt - 1, to: list[0].startedAt + 1 } as Trip;
  assert.equal(tripOf(list[0], [trip])?.id, 't');
  assert.equal(tripOf(list[1], [trip]), undefined);
  const b = biggestScores(list);
  assert.equal(b[0].prize, 60000);
  assert.equal(b[0].multiple, 6);
  assert.equal(b.length, 2);
});
