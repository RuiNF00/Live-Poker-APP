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
  assert.equal(r.transfers, 0);
  assert.equal(r.moves.length, 1);
  assert.deepEqual([r.moves[0].kind, r.moves[0].amount, r.moves[0].currency], ['deposit', 1060, '€']);
  assert.deepEqual(r.sessions.map((s) => s.format), ['live', undefined, 'live']);
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

test('Date, Start and End with only times in Start and End: the date column wins, times go on its day', () => {
  const csv = 'Date,Start,End,Game,Buy In,Cash Out\n17/10/2026,20:00,23:30,NLH,100,250\n18/10/2026,22:00,02:15,NLH,100,50\n';
  const r = run(csv);
  assert.equal(r.failed.length, 0);
  assert.equal(r.mapping.start, 0);
  assert.equal(r.mapping.time, 1);
  assert.equal(r.mapping.end, 2);
  const [a, b] = r.sessions;
  assert.equal(a.startedAt, new Date(2026, 9, 17, 20, 0).getTime());
  assert.equal(playedMs(a) / 60000, 210);
  // End earlier than the start: past midnight.
  assert.equal(b.endedAt, new Date(2026, 9, 19, 2, 15).getTime());
  assert.equal(playedMs(b) / 60000, 255);
});

test('a column of only times is never taken as the date, whatever its name', () => {
  const r = run('Start,Data,Fim,Lucro\n20h00,17/10/2026,8:30 PM,50\n');
  assert.equal(r.mapping.start, 1);
  assert.equal(r.mapping.time, 0);
  assert.equal(playedMs(r.sessions[0]) / 60000, 30);
  // Mapped by hand onto the date anyway, every row still fails as an unreadable date.
  const p = prepare('Start,End,Profit\n20:00,23:30,50\n');
  assert.equal(p.mapping.start, undefined);
  const hand = toSessions(p.table, { ...p.mapping, start: 0 }, { ...opt, source: p.source });
  assert.deepEqual(hand.failed.map((f) => f.reason), ['badDate']);
});

test('an end time no clock shows fails the row instead of being guessed', () => {
  const r = run('Date,Start,End,Profit\n17/10/2026,20:00,25:10,50\n17/10/2026,20:00,13:00 PM,50\n17/10/2026,20:00,21:00,50\n');
  assert.deepEqual(r.failed.map((f) => [f.line, f.reason, f.value]), [[2, 'badDate', '25:10'], [3, 'badDate', '13:00 PM']]);
  assert.equal(r.sessions.length, 1);
  assert.equal(playedMs(r.sessions[0]) / 60000, 60);
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
  assert.equal(new Date(r.sessions[0].startedAt).getHours(), 20, 'start time comes back too');
});

test('Sweatbook CSV in the Portuguese layout (semicolons, decimal commas, a BOM) imports back the same', () => {
  const base: Session = {
    id: 'pt', kind: 'cash', name: 'NLH 1/2', venue: 'Póvoa', currency: '€', startedAt: new Date(2026, 8, 3, 20).getTime(), endedAt: new Date(2026, 8, 3, 22, 30).getTime(),
    breaks: [], buyIn: 33.3, entries: 3, addOn: 0, cashOut: 150.45, tips: 2.5, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '-bad beat',
  };
  const text = '\uFEFF' + sessionsCsv([base], [], [], [], ';');
  const r = run(text);
  assert.equal(r.source, 'sweatbook');
  assert.equal(r.sessions.length, 1);
  const s = r.sessions[0];
  const c = (n: number) => Math.round(n * 100);
  assert.equal(c(profit(s)), c(profit(base)));
  assert.equal(s.cashOut, 150.45);
  assert.equal(s.tips, 2.5);
  assert.equal(s.venue, 'Póvoa');
  assert.equal(s.notes, '-bad beat');
  assert.equal(playedMs(s), 2.5 * 3600000);
});

test('Sweatbook CSV keeps tips and hands apart from expenses', () => {
  const base: Session = {
    id: 'y', kind: 'cash', name: 'NLH 2/5', venue: 'Bellagio', currency: '$', startedAt: new Date(2026, 8, 2, 19).getTime(), endedAt: new Date(2026, 8, 2, 23).getTime(),
    breaks: [], buyIn: 1000, entries: 1, addOn: 0, cashOut: 1800, expenses: 30, tips: 45, handsDealt: 120, sb: 2, bb: 5, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '',
  };
  const s = run(sessionsCsv([base])).sessions[0];
  assert.equal(s.tips, 45);
  assert.equal(s.expenses, 30);
  assert.equal(s.handsDealt, 120);
  assert.equal(profit(s), profit(base));
});

test('rows without a date or money are counted, not imported', () => {
  const r = run('Date,Location,Profit\nnope,X,10\n2025-01-01,Y,\n2025-01-02,Z,5\n');
  assert.equal(r.sessions.length, 1);
  assert.equal(r.unreadable, 2);
});

test('dot thousands, the currency written in the amount, and unreadable amounts', () => {
  assert.equal(parseNum('R$ 1.235'), 1235);
  assert.equal(parseNum('10.000 €'), 10000);
  assert.equal(parseNum('1.000.000'), 1000000);
  assert.equal(parseNum('1.250'), 1.25, 'a bare number keeps its decimal point');
  const r = run('date,venue,profit\n2024-03-01,A,$120\n2024-03-02,B,80 €\n2024-03-03,C,R$ 1.235\n2024-03-04,D,12.5.3\n');
  assert.deepEqual(r.sessions.map((s) => s.currency), ['$', '€', 'R$']);
  assert.equal(r.unreadable, 1, '"12.5.3" is not read as 0');
});

test('the file decides the decimal mark: a bare "10.000" is never read as 10', () => {
  const profits = (text: string) => run(text).sessions.map((x) => profit(x));
  // Decimal commas elsewhere in the file: dots are thousands.
  assert.deepEqual(profits('date,venue,profit\n2024-03-01,A,"10.000"\n2024-03-02,B,"12,50"\n2024-03-03,C,"-1.235"\n2024-03-04,D,(1.235)\n'), [10000, 12.5, -1235, -1235]);
  // Semicolons and no decimals at all: the same.
  assert.deepEqual(profits('date;venue;profit\n2024-03-01;A;100.000\n2024-03-02;B;1.500\n'), [100000, 1500]);
  // Decimal points elsewhere: commas are thousands, "1.500" is one and a half.
  assert.deepEqual(profits('date,venue,profit\n2024-03-01,A,"1,500"\n2024-03-02,B,12.50\n'), [1500, 12.5]);
  // Nothing says which: a bare "10.000" fails the row instead of a silent guess; with a symbol it is clear.
  const r = run('date,venue,profit\n2024-03-01,A,10.000\n2024-03-02,B,10.000 €\n2024-03-03,C,250\n2024-03-04,D,"1,500"\n');
  assert.deepEqual(r.sessions.map((x) => profit(x)), [10000, 250]);
  assert.equal(r.unreadable, 2);
  // Hands dealt follow the file's mark too.
  assert.equal(run('date;venue;profit;hands\n2024-03-01;A;12,50;1.200\n').sessions[0].handsDealt, 1200);
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

test('online sessions and withdrawals in a generic file', () => {
  const csv = 'Date,Type,Site,Result,Note\n2025-05-01,Cash,PokerStars,120,\n2025-05-02,Cash,Casino Estoril,-40,\n2025-05-03,Withdrawal,,-500,levantei\n2025-05-04,Deposit,,300,\n';
  const r = run(csv);
  assert.deepEqual(r.sessions.map((s) => s.format), ['online', undefined], 'missing means live');
  assert.deepEqual(r.moves.map((m) => [m.kind, m.amount, m.note]), [['withdrawal', 500, 'levantei'], ['deposit', 300, '']]);
});

test('Sweatbook CSV with deposits and withdrawals comes back whole', () => {
  const s: Session = {
    id: 'x', kind: 'cash', name: 'NLH 1/2', venue: 'Estoril', currency: '€', startedAt: new Date(2026, 8, 1, 20).getTime(), endedAt: new Date(2026, 8, 1, 23).getTime(),
    breaks: [], buyIn: 200, entries: 1, addOn: 0, cashOut: 450, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', format: 'online',
  };
  const br = [{ id: 'b', name: 'Principal', currency: '€', createdAt: 0 }];
  const tx = [
    { id: 't1', bankrollId: 'b', kind: 'deposit' as const, amount: 1000, at: new Date(2026, 7, 1).getTime(), note: 'início' },
    { id: 't2', bankrollId: 'b', kind: 'withdrawal' as const, amount: 250, at: new Date(2026, 8, 5).getTime(), note: '' },
  ];
  const r = run(sessionsCsv([s], br, tx));
  assert.equal(r.source, 'sweatbook');
  assert.equal(r.sessions.length, 1);
  assert.equal(r.sessions[0].format, 'online');
  assert.deepEqual(r.moves.map((m) => [m.kind, m.amount]), [['deposit', 1000], ['withdrawal', 250]]);
});

test('Poker Analytics exports in French and Spanish: localized headers, 20h00, venue in "Lugar"', () => {
  const fr = run('Date de début;Date de fin;Type;Jeu;Lieu;Devise;Buy-in;Gains;Résultat\n17/10/2026 20h00;18/10/2026 01h30;Cash game;NLHE;Casino Barrière;EUR;200,00;455,00;255,00\n19/10/2026 18:00;19/10/2026 23:00;Tournoi;NLHE;Casino Barrière;EUR;150,00;0,00;-150,00\n');
  assert.deepEqual(fr.sessions.map(profit), [255, -150]);
  assert.deepEqual(fr.sessions.map((s) => s.kind), ['cash', 'mtt']);
  assert.equal(playedMs(fr.sessions[0]) / 3600000, 5.5);
  const es = run('Fecha inicio;Fecha fin;Tipo;Juego;Lugar;Moneda;Entrada;Ganancias;Resultado\n17/10/2026 20:00;18/10/2026 01:30;Cash;NLHE;Casino Madrid;EUR;200;455;255\n');
  assert.equal(es.sessions[0].venue, 'Casino Madrid');
  assert.equal(es.sessions[0].finish, undefined);
  // In Portuguese "Lugar" is still the finishing place.
  const pt = run('Data;Tipo;Local;Buy-in;Prémio;Lugar\n03/04/2025;Torneio;Casino Póvoa;100;400;3\n');
  assert.equal(pt.sessions[0].finish, 3);
  assert.equal(pt.sessions[0].venue, 'Casino Póvoa');
});

test('game types, dates and durations as other trackers write them', () => {
  const r = run('Start,Type,Profit,Duration\n"Sat, Oct 17 2026",Sit and Go,100,1d 2h\n"17 de octubre de 2026 20:00",Freeroll,0,5h30\n');
  assert.deepEqual(r.sessions.map((s) => s.kind), ['mtt', 'mtt']);
  assert.equal(playedMs(r.sessions[0]) / 3600000, 26);
  assert.equal(new Date(r.sessions[1].startedAt).getHours(), 20);
  assert.equal(parseDate('Oct. 17, 2026', 'dmy')?.t, new Date(2026, 9, 17).getTime());
});

test('parseCsv: quotes, doubled quotes, line breaks inside quotes and text after a closing quote', () => {
  assert.deepEqual(parseCsv('a, "b, c" ,"d ""e"""\r\n"x\ny",z\n"unclosed, \nend', ','), [
    ['a', 'b, c', 'd "e"'],
    ['x\ny', 'z'],
    ['unclosed, \nend'],
  ]);
  assert.deepEqual(parseCsv('"a"b,c "d"\n', ','), [['ab', 'c "d"']]);
  assert.deepEqual(parseCsv('﻿x;y\n1;2', ';'), [['x', 'y'], ['1', '2']]);
});

const bigFile = (n: number) =>
  ['Date,Location,Expense,Currency,Profit', ...Array.from({ length: n }, (_, i) => `2020-01-01,Casino ${i % 7},0,EUR,${(i % 50) - 20}`)].join('\n');

test('a 5,000-session file is converted in steps with progress, and gives the same sessions', async () => {
  const { toSessionsAsync } = await import('../convert');
  const p = prepare(bigFile(5000));
  const o = { ...opt, source: p.source };
  const seen: number[] = [];
  const r = await toSessionsAsync(p.table, p.mapping, o, { onProgress: (done, total) => seen.push(done / total), sliceMs: 0 });
  assert.ok(r);
  assert.deepEqual(r, toSessions(p.table, p.mapping, o));
  assert.equal(r.sessions.length, 5000);
  assert.ok(seen.length >= 10 && seen.every((x, i) => x > 0 && x < 1 && (i === 0 || x > seen[i - 1])));
});

test('leaving or changing a column midway gives nothing, so nothing is half imported', async () => {
  const { toSessionsAsync } = await import('../convert');
  const p = prepare(bigFile(2000));
  let steps = 0;
  const r = await toSessionsAsync(p.table, p.mapping, { ...opt, source: p.source }, { onProgress: () => steps++, cancelled: () => steps >= 3, sliceMs: 0 });
  assert.equal(r, null);
  assert.equal(steps, 3);
});

test('Sweatbook CSV round trip: export, import, and import again into the same phone', async () => {
  const { place } = await import('../bankrolls');
  const { mergeById } = await import('../../store/backup');
  const brs = [
    { id: 'b1', name: 'Principal', currency: '€', createdAt: 1 },
    { id: 'b2', name: 'Viagens', currency: '€', createdAt: 2 },
  ];
  const start = new Date(2026, 2, 29, 1, 30, 17).getTime(); // the night the clocks change in Portugal
  const mk = (i: number, x: Partial<Session> = {}): Session => ({
    id: 's' + i, kind: 'cash', name: 'NLH 1/2', venue: 'Estoril, "sala 2"', currency: '€', startedAt: start + i * 86_400_000, endedAt: start + i * 86_400_000 + 5 * 3_600_000 + 41_000,
    breaks: [{ start: start + i * 86_400_000 + 3_600_000, end: start + i * 86_400_000 + 3_600_000 + 25 * 60_000 }],
    buyIn: 200.37, entries: 1, addOn: 0, cashOut: 455.1, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: 'a, b\n"c"', bankrollId: 'b2', ...x,
  });
  const list = [mk(0), mk(1, { kind: 'mtt', name: 'Main Event', buyIn: 1100, entries: 2, cashOut: 0, finish: 40, field: 900, day: 2, country: 'US', currency: '$', bankrollId: undefined, sb: 0, bb: 0 }), mk(2, { bankrollId: 'b1', format: 'online', tips: 4.5 }), mk(4, { kind: 'mtt', name: 'Main', buyIn: 1500, cashOut: 4567.89, makeupCut: 101.01, currency: 'R$', bankrollId: undefined, finish: 3, field: 200, sb: 0, bb: 0 })];
  const tx = [{ id: 't1', bankrollId: 'b2', kind: 'deposit' as const, amount: 500.5, at: start - 86_400_000, note: '' }];
  const trip = { id: 'tr', name: 'Vegas', venue: 'Bellagio', currency: '$', from: start, to: start + 3 * 86_400_000, expenses: [], createdAt: 0 };
  const csv = sessionsCsv(list, brs, tx, [{ trip, x: { id: 'e', kind: 'hotel', amount: 200, currency: '$', at: start, note: '' } }]);
  const r = run(csv);
  assert.equal(r.source, 'sweatbook');
  assert.equal(r.sessions.length, 4, 'the trip expense does not become a session');
  const back = place(r, { '€': 'b1', $: 'new', R$: 'new' }, { source: r.source, appName: 'Sweatbook', bankrolls: brs, names: r.bankrollNames });
  for (const s of list) {
    const o = back.sessions.find((x) => x.id === s.id)!;
    assert.ok(o, s.id);
    assert.equal(Math.round(profit(o) * 100), Math.round(profit(s) * 100));
    assert.equal(o.cashOut, s.cashOut, 'cash_out as entered, the makeup cut apart');
    assert.equal(o.expenses ?? 0, s.expenses ?? 0);
    assert.equal(o.currency, s.currency);
    assert.equal(o.kind, s.kind);
    assert.equal(o.startedAt, s.startedAt);
    assert.equal(o.endedAt, s.endedAt);
    assert.ok(Math.abs(playedMs(o) - playedMs(s)) <= 18_000, 'hours are written to 2 decimals');
    assert.equal(o.notes, s.notes);
    assert.equal(o.format ?? 'live', s.format ?? 'live');
    assert.equal(o.finish, s.finish);
    assert.equal(o.day, s.day);
    assert.equal(o.country, s.country);
  }
  assert.equal(back.sessions[0].bankrollId, 'b2', 'back to the bankroll of the same name');
  assert.equal(back.transfers[0].id, 't1');
  assert.equal(back.transfers[0].bankrollId, 'b2');
  assert.equal(mergeById(list, back.sessions).added, 0, 'importing it again adds nothing');
  // A file from before the exact-time columns still reads.
  const old = sessionsCsv([mk(3, { venue: 'Estoril', notes: '' })]).trim().split('\n').map((l) => l.split(',').slice(0, -3).join(','));
  assert.equal(run(old.join('\n')).sessions[0].startedAt, mk(3).startedAt - 17_000, 'to the minute, as before');
});
