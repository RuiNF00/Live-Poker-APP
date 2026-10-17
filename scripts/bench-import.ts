// What a years-long history costs to import: npm run bench:import [n]
// Builds an n-session file in each of the top-3 formats (Poker Bankroll
// Tracker, Pokerbase, Poker Analytics) and times every step the import
// screen runs, up to the sessions written to storage.

import { performance } from 'node:perf_hooks';

import { place, defaultPlacement, currenciesOf } from '../src/import/bankrolls';
import { prepare, toSessions } from '../src/import/convert';
import { importRecap } from '../src/import/recap';
import { mergeById } from '../src/store/backup';
import { SPECS } from '../src/store/boot';
import { createWriter } from '../src/store/persist';
import { FakeStorage } from '../src/store/__tests__/fake-storage';
import type { Session } from '../src/store/types';

const N = Number(process.argv[2] ?? 5000);
const VENUES = ['Casino Estoril', 'Casino Lisboa', 'Casino da Póvoa', 'Valentino', 'Gran Madrid', 'Casino Espinho'];
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const day = (d: Date) => stamp(d).slice(0, 10);
// One session every ~17 h, going back from today: 5000 is about 10 years.
const when = (i: number) => new Date(Date.UTC(2026, 9, 1, 20) - i * 17 * 3_600_000);

function pbt(n: number): string {
  const head = 'id,starttime,endtime,breakminutes,playingminutes,variant,game,limit,tablesize,location,type,currency,exchangerate,buyin,cashout,netprofit,grossprofit,rebuys,rebuycosts,addoncosts,bounties,bountycosts,smallblind,bigblind,3rdblind,ante,expenses,expensesfromstack,handsperhour,place,player,itm,mttname,startstack,private,casinoid,staking,stakingpercent,sharesincomings,sharesoutgoings,stakingplayer,sessionnote,tags,notes,chipgraph,updatetimes';
  const lines = ['---', '---PBT Bankroll Export---' + ','.repeat(45), head];
  for (let i = 0; i < n; i++) {
    const s = when(i);
    const e = new Date(s.getTime() + (3 + (i % 6)) * 3_600_000);
    const mtt = i % 3 === 0;
    const buy = mtt ? 110 : 200;
    const out = (i * 37) % 500;
    lines.push([i + 1, stamp(s), stamp(e), '', '', mtt ? 'Tournament' : 'Cash Game', 'Holdem', 'No Limit', '', VENUES[i % VENUES.length], 'Casino', 'EUR', '', buy, out, out - buy, '', '', '', '', '', '', mtt ? '' : '"1"', mtt ? '' : '"2"', '', '', '', '', '', mtt ? String(1 + (i % 90)) : '', '', '', mtt ? 'Evento ' + i : '', '', '', '', '', '', '', '', '', i % 10 === 0 ? 'nota ' + i : '', '', '', '', ''].join(','));
  }
  return lines.join('\n');
}

function pokerbase(n: number): string {
  const lines = ['Date,Location,Expense,Currency,Profit'];
  for (let i = 0; i < n; i++) lines.push([day(when(i)), VENUES[i % VENUES.length], i % 4 ? 0 : 10, 'EUR', ((i * 53) % 900) - 400].join(','));
  return lines.join('\n');
}

function pokeranalytics(n: number): string {
  const lines = ['Start Date,End Date,Game,Stakes,Location,Buy In,Cash Out,Tips,Comment'];
  for (let i = 0; i < n; i++) {
    const s = when(i);
    const e = new Date(s.getTime() + (2 + (i % 5)) * 3_600_000);
    lines.push([`"${stamp(s).slice(0, 16)}"`, `"${stamp(e).slice(0, 16)}"`, i % 2 ? 'PLO' : 'NLHE', i % 2 ? '2/5' : '1/2', VENUES[i % VENUES.length], 200, (i * 41) % 600, i % 3 ? 0 : 10, i % 7 ? '' : 'boa'].join(','));
  }
  return lines.join('\n');
}

function time<T>(fn: () => T): { ms: number; out: T } {
  const t0 = performance.now();
  const out = fn();
  return { ms: performance.now() - t0, out };
}

async function run(name: string, text: string) {
  const steps: [string, number][] = [];
  const read = time(() => prepare(text));
  steps.push(['Ler o ficheiro', read.ms]);
  const file = read.out;
  const conv = time(() => toSessions(file.table, file.mapping, { currency: 'EUR', tableSize: 9, source: file.source }));
  steps.push(['Converter em sessões', conv.ms]);
  const r = conv.out;
  // The review screen: what it works out on every render.
  const review = time(() => {
    const have = new Set<string>();
    const fresh = r.sessions.filter((s) => !have.has(s.id)).length;
    const list = [...r.sessions].sort((a, b) => b.startedAt - a.startedAt);
    return fresh + list.length + currenciesOf(r.sessions, r.moves, 'EUR').length;
  });
  steps.push(['Ecrã de revisão (por render)', review.ms]);
  const placed = time(() => place(r, defaultPlacement(currenciesOf(r.sessions, r.moves, 'EUR'), [], undefined), { source: file.source, appName: name, bankrolls: [] }));
  steps.push(['Escolher bankroll', placed.ms]);
  const merged = time(() => mergeById<Session>([], placed.out.sessions));
  steps.push(['Juntar às sessões', merged.ms]);
  const recap = time(() => importRecap(placed.out.sessions, merged.out.list));
  steps.push(['Resumo final', recap.ms]);
  const kv = new FakeStorage();
  const w = createWriter<Session>(kv, SPECS.sessions, [], (e) => { throw e; }, 0);
  const t0 = performance.now();
  w.schedule(merged.out.list);
  await w.flush();
  steps.push(['Gravar (CPU, sem disco)', performance.now() - t0]);
  const total = steps.reduce((a, [, ms]) => a + ms, 0);
  console.log(`\n${name}: ${r.sessions.length} sessões, ${(text.length / 1024).toFixed(0)} KB`);
  for (const [k, ms] of steps) console.log(`  ${k.padEnd(30)} ${ms.toFixed(1).padStart(8)} ms`);
  console.log(`  ${'Total'.padEnd(30)} ${total.toFixed(1).padStart(8)} ms`);
}

async function main() {
  // npm run bench:import 5000 -- --out dir: also writes the three files, to try them in the app.
  const out = process.argv.indexOf('--out');
  if (out > 0) {
    const { writeFileSync } = await import('node:fs');
    const dir = process.argv[out + 1];
    writeFileSync(`${dir}/pbt-${N}.csv`, pbt(N));
    writeFileSync(`${dir}/pokerbase-${N}.csv`, pokerbase(N));
    writeFileSync(`${dir}/pokeranalytics-${N}.csv`, pokeranalytics(N));
  }
  await run('Poker Bankroll Tracker', pbt(N));
  await run('Pokerbase', pokerbase(N));
  await run('Poker Analytics', pokeranalytics(N));
}

main();
