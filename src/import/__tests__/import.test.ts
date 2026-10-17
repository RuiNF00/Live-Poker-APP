/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sessionsCsv } from '../../store/backup';
import { playedMs, profit, totals } from '../../store/session-math';
import type { Session } from '../../store/types';
import { detectSeparator, parseCsv } from '../csv';
import { guessOrder, parseDate, parseNum, prepare, toSessions } from '../convert';

const opt = { currency: '€', tableSize: 9 };
const run = (text: string, extra: Partial<Parameters<typeof toSessions>[2]> = {}) => {
  const p = prepare(text);
  return { ...p, ...toSessions(p.table, p.mapping, { ...opt, source: p.source, ...extra }) };
};

// Same layout and values as pokerbankrolltracker.net/PBT_Bankroll_CSV_example.csv.
const PBT_HEAD =
  'id,starttime,endtime,breakminutes,playingminutes,variant,game,limit,tablesize,location,type,currency,exchangerate,buyin,cashout,netprofit,grossprofit,rebuys,rebuycosts,addoncosts,bounties,bountycosts,smallblind,bigblind,3rdblind,ante,expenses,expensesfromstack,handsperhour,place,player,itm,mttname,startstack,private,casinoid,staking,stakingpercent,sharesincomings,sharesoutgoings,stakingplayer,sessionnote,tags,notes,chipgraph,updatetimes';
const pbtRow = (v: Record<string, string>) =>
  PBT_HEAD.split(',')
    .map((h) => (/[",]/.test(v[h] ?? '') ? `"${v[h].replace(/"/g, '""')}"` : (v[h] ?? '')))
    .join(',');
const PBT = [
  '---',
  '---PBT Bankroll Export---' + ','.repeat(45),
  PBT_HEAD,
  pbtRow({ id: '1', starttime: '2024-09-20 18:51:57', endtime: '2024-09-21 03:44:00', breakminutes: '0', playingminutes: '532', variant: 'Cash Game', game: 'Holdem', limit: 'No Limit', tablesize: 'Full-Ring', location: 'Valentino', type: 'Club', currency: 'EUR', buyin: '105', cashout: '680', netprofit: '475', grossprofit: '482', rebuys: '1', rebuycosts: '100', smallblind: '0,5', bigblind: '0,5', expensesfromstack: '7', sessionnote: 'Mesa boa, "fish" no 4' }),
  pbtRow({ id: '2', starttime: '2024-08-17 15:00:00', endtime: '2024-08-17 19:46:00', playingminutes: '286', variant: 'Cash Game', game: 'Holdem', limit: 'No Limit', location: 'Grand Casino Aš', currency: 'EUR', buyin: '200', cashout: '80', netprofit: '-120' }),
  pbtRow({ id: '3', starttime: '2024-08-17 20:32:32', endtime: '2024-08-17 22:30:00', breakminutes: '18', playingminutes: '99', variant: 'Tournament', game: 'Holdem', limit: 'No Limit', tablesize: 'Full-Ring', location: 'Grand Casino Aš', type: 'Casino', currency: 'EUR', buyin: '130', cashout: '0', netprofit: '-117', place: '98', player: '171', mttname: 'Super Freezeout', sharesincomings: '13', tags: 'BHD Asch 2024' }),
  pbtRow({ starttime: '2024-05-28 14:29:00', endtime: '2024-05-28 14:29:00', variant: 'Deposit/Payout', currency: 'EUR', buyin: '0', cashout: '1060', netprofit: '1060', grossprofit: '1060' }),
  '',
].join('\n');

test('reads the Poker Bankroll Tracker export with its title line', () => {
  const r = run(PBT);
  assert.equal(r.source, 'pbt');
  assert.equal(r.sessions.length, 3);
  assert.equal(r.transfers, 1);
  const [cash, cash2, mtt] = r.sessions;
  assert.equal(cash.kind, 'cash');
  assert.equal(cash.name, 'NLH 0,5/0,5');
  assert.equal(cash.venue, 'Valentino');
  assert.equal(cash.currency, '€');
  assert.equal(cash.notes, 'Mesa boa, "fish" no 4');
  assert.equal(profit(cash), 475);
  assert.equal(Math.round(playedMs(cash) / 60000), 532);
  assert.equal(profit(cash2), -120);
  assert.equal(mtt.kind, 'mtt');
  assert.equal(mtt.name, 'Super Freezeout');
  assert.equal(profit(mtt), -117);
  assert.equal(mtt.cashOut, 0, 'staking income must not count as a cash');
  assert.deepEqual([mtt.finish, mtt.field], [98, 171]);
  assert.equal(Math.round(playedMs(mtt) / 60000), 99);
  assert.match(mtt.notes, /#BHD Asch 2024/);
  assert.equal(totals(r.sessions).profit, 475 - 120 - 117);
});

test('importing the same file twice gives the same ids', () => {
  assert.deepEqual(run(PBT).sessions.map((s) => s.id), run(PBT).sessions.map((s) => s.id));
  assert.equal(new Set(run(PBT).sessions.map((s) => s.id)).size, 3);
});

test('Pokerbase: only date, place, expense, currency and profit', () => {
  const csv = 'Date,Location,Expense,Currency,Profit\n2025-03-01,Casino Estoril,10,EUR,250\n2025-03-08,Casino Lisboa,0,EUR,-180.5\n';
  const r = run(csv);
  assert.equal(r.source, 'pokerbase');
  assert.deepEqual(r.sessions.map(profit), [250, -180.5]);
  assert.deepEqual(r.sessions.map((s) => s.kind), ['cash', 'cash']);
  assert.equal(r.sessions[0].expenses, 10);
  assert.equal(new Date(r.sessions[0].startedAt).getHours(), 18);
});

test('generic European CSV: semicolons, day first, comma decimals, Portuguese names', () => {
  const csv = 'Data;Tipo;Torneio;Local;Buy-in;Prémio;Lugar;Jogadores;Horas\n03/04/2025;Torneio;Main Event;Casino Póvoa;1.100,00;4.250,50;7;312;9,5\n15/04/2025;Cash;;Casino Espinho;300;520;;;4\n';
  assert.equal(detectSeparator(csv), ';');
  const r = run(csv);
  assert.equal(r.source, 'generic');
  assert.equal(r.order, 'dmy');
  const [m, c] = r.sessions;
  assert.equal(m.kind, 'mtt');
  assert.equal(m.name, 'Main Event');
  assert.equal(new Date(m.startedAt).getMonth(), 3);
  assert.equal(new Date(m.startedAt).getDate(), 3);
  assert.equal(profit(m), 3150.5);
  assert.deepEqual([m.finish, m.field], [7, 312]);
  assert.equal(playedMs(m) / 3600000, 9.5);
  assert.equal(c.kind, 'cash');
  assert.equal(profit(c), 220);
});

test('US dates with AM/PM, separate end time past midnight, money with symbols', () => {
  const csv = 'Start Date,End Date,Game,Stakes,Location,Buy In,Cash Out\n"04/21/2025 9:30 PM","04/22/2025 2:15 AM",NLH,1/3,Bellagio,"$1,000.00",($0)\n';
  const r = run(csv, {});
  assert.equal(r.order, 'mdy');
  const s = r.sessions[0];
  assert.equal(s.name, 'NLH 1/3');
  assert.equal(profit(s), -1000);
  assert.equal(playedMs(s) / 60000, 285);
});

test('Sweatbook CSV comes back as the same sessions', () => {
  const base: Session = {
    id: 'x', kind: 'mtt', name: 'Estoril €150', venue: 'Estoril', currency: '€', startedAt: new Date(2026, 8, 1, 20).getTime(), endedAt: new Date(2026, 8, 1, 23).getTime(),
    breaks: [], buyIn: 150, entries: 2, addOn: 50, cashOut: 900, finish: 3, field: 120, sb: 0, bb: 0, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: 'ok',
  };
  const r = run(sessionsCsv([base]));
  assert.equal(r.source, 'sweatbook');
  assert.equal(profit(r.sessions[0]), profit(base));
  assert.equal(r.sessions[0].kind, 'mtt');
  assert.equal(playedMs(r.sessions[0]), 3 * 3600000);
});

test('rows without a date or money are counted, not imported', () => {
  const r = run('Date,Location,Profit\nnope,X,10\n2025-01-01,Y,\n2025-01-02,Z,5\n');
  assert.equal(r.sessions.length, 1);
  assert.equal(r.unreadable, 2);
});

test('numbers and dates', () => {
  assert.equal(parseNum('1.234,56'), 1234.56);
  assert.equal(parseNum('1,234.56'), 1234.56);
  assert.equal(parseNum('0,5'), 0.5);
  assert.equal(parseNum('1,500'), 1500);
  assert.equal(parseNum('-€120'), -120);
  assert.equal(parseNum('(45)'), -45);
  assert.equal(parseNum('−30'), -30);
  assert.equal(parseNum(''), null);
  assert.equal(guessOrder(['01/02/2025', '25/02/2025']), 'dmy');
  assert.equal(guessOrder(['01/02/2025', '02/25/2025']), 'mdy');
  assert.equal(parseDate('2025-02-30', 'dmy'), null);
  assert.equal(new Date(parseDate('17 Oct 2025', 'dmy')!.t).getMonth(), 9);
  assert.deepEqual(parseCsv('a,"b ""c""\nd",e\r\n1,2,3'), [['a', 'b "c"\nd', 'e'], ['1', '2', '3']]);
});
