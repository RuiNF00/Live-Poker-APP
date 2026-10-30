/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sessionsCsv } from '../../store/backup';
import { cost, profit } from '../../store/session-math';
import type { Session } from '../../store/types';
import { parseHours, prepare, toSessions } from '../convert';
import { parseNum } from '../num';
import { parseResults } from '../results';

const run = (text: string) => {
  const p = prepare(text);
  return toSessions(p.table, p.mapping, { currency: '€', tableSize: 9, source: p.source });
};

test('tournaments with «Bankroll», «Rakeback», «Bonus» or «Deposit» in the name stay tournaments', () => {
  const r = run('Date,Tournament,Buy-in,Prize\n2024-03-01,$5 Bankroll Builder,5,0\n2024-03-02,Rakeback Race Freeroll,0,25\n2024-03-04,Deposit Bonus Freeroll,0,12\n');
  assert.equal(r.moves.length, 0);
  assert.deepEqual(r.sessions.map((s) => profit(s)), [-5, 25, 12]);
  const g = run('Date,Game,Location,Buy-in,Cash-out\n2024-03-01,NLH Bankroll Builder,Stars,11,40\n');
  assert.equal(g.moves.length, 0);
  assert.equal(profit(g.sessions[0]), 29);
  const pb = run("Date,Location,Game,Profit,Expenses\n2024-03-02,Aria,Bonus Hold'em,-80,0\n");
  assert.equal(pb.moves.length, 0);
  assert.equal(profit(pb.sessions[0]), -80);
});

test('a row that is only a deposit or a withdrawal is still money moved', () => {
  const r = run('Date,Game,Buy-in,Cash-out\n2024-03-01,Deposit,500,\n2024-03-02,Withdrawal,,200\n2024-03-03,NLH 1/2,100,180\n');
  assert.equal(r.moves.length, 2);
  assert.equal(r.sessions.length, 1);
});

test('French places «3e» and «3ème» read as places, so the prize is the prize', () => {
  for (const place of ['3e', '3ème', '3eme']) {
    const [row] = parseResults(`01/03/2024 Main Event 550€ ${place} 12 400 €`).rows;
    assert.equal(row.finish, 3, place);
    assert.equal(row.prize, 12400, place);
    assert.equal(row.buyIn, 550, place);
  }
  // «100e» as euros next to a real place: the place wins.
  const [pt] = parseResults('01/03/2024 Torneio 100e 3º 500 €').rows;
  assert.equal(pt.finish, 3);
});

test('a German «Gewinn» column with losses in it is the net result, not the cash-out', () => {
  const r = run('Datum;Ort;Einsatz;Gewinn\n01.03.2024;Casino Wien;100;150\n02.03.2024;Casino Wien;100;-100\n');
  assert.equal(r.sessions.reduce((a, s) => a + profit(s), 0), 50);
});

test('durations written with letters', () => {
  assert.equal(parseHours('1 hr 30 min'), 1.5);
  assert.equal(parseHours('2 hrs 15 mins'), 2.25);
  assert.equal(parseHours('45m'), 0.75);
  assert.equal(parseHours('30 m'), 0.5);
  assert.equal(parseHours('45s'), null);
  // Unchanged.
  assert.equal(parseHours('3:30'), 3.5);
  assert.equal(parseHours('3h30'), 3.5);
  assert.equal(parseHours('3,5'), 3.5);
  assert.equal(parseHours('5 hours'), 5);
  assert.equal(parseHours('1d 2h'), 26);
});

test('amounts with an ISO currency code or a «,-»', () => {
  assert.equal(parseNum('100 EUR'), 100);
  assert.equal(parseNum('EUR 100'), 100);
  assert.equal(parseNum('-50 EUR'), -50);
  assert.equal(parseNum('1.234,56 EUR'), 1234.56);
  assert.equal(parseNum('100 SEK'), 100);
  assert.equal(parseNum('€ 100,-'), 100);
  assert.equal(parseNum('100,-'), 100);
  // Unchanged.
  assert.equal(parseNum('1e3'), 1000);
  assert.equal(parseNum('1.5k'), 1500);
  assert.equal(parseNum('(1.234,56)'), -1234.56);
  assert.equal(parseNum('USD 2,000.50'), 2000.5);
});

test("Sweatbook's own CSV brings back re-entries and the add-on", () => {
  const base = {
    id: 'b', kind: 'mtt', name: 'Main', venue: 'V', currency: '€', startedAt: new Date(2026, 3, 3, 12).getTime(), endedAt: new Date(2026, 3, 3, 23).getTime(), breaks: [],
    buyIn: 1100, entries: 3, addOn: 550, cashOut: 25000, bounties: 3000, finish: 2, field: 900, sb: 0, bb: 0, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '',
  } as Session;
  const [back] = run(sessionsCsv([base])).sessions;
  assert.deepEqual([back.buyIn, back.entries, back.addOn], [1100, 3, 550]);
  assert.equal(cost(back), cost(base));
  assert.equal(profit(back), profit(base));
});
