// Times what the app does with five years of heavy data (see
// src/store/__tests__/heavy-seed.ts), step by step, in Node. A mid-range
// Android phone runs this JS roughly 5–8× slower than a laptop's Node, so the
// perf test's budgets are the phone budgets divided by that.
//
//   npx tsx src/store/__tests__/perf-bench.ts

import { isComplete, replay } from '@/poker/engine';
import { needsReview } from '@/poker/review';
import { balanceOf, ensureBankrolls, ledger, sessionsIn, applyFilter } from '@/store/bankroll-math';
import { loadAll } from '@/store/boot';
import { insights } from '@/store/insights-math';
import { opponentStats, handCounts } from '@/store/queries';
import { bestWeekday, dailyResults, downswings, drawdown, lastResults, verdict } from '@/store/results-math';
import { curve, totals } from '@/store/session-math';
import { packageStates, withCuts } from '@/store/staking';
import { finishedTourneys, summarize } from '@/store/tourney-stats';
import { cashDone, winRate, winRateBy } from '@/store/winrate-math';
import { heavyData, heavyStorage } from '@/store/__tests__/heavy-seed';

export async function bench() {
  const out: Record<string, number> = {};
  const time = async <T>(name: string, f: () => T | Promise<T>): Promise<T> => {
    const t0 = performance.now();
    const r = await f();
    out[name] = +(performance.now() - t0).toFixed(1);
    return r;
  };
  const d = heavyData();
  const kv = heavyStorage(d);
  const boot = await time('arranque: ler e validar tudo', () => loadAll(kv));
  const sessions = await time('sessões com cortes de pacotes', () => withCuts(boot.sessions.items, boot.packages.items));
  const hands = boot.hands.items;
  await time('início: mãos incompletas (replay de todas)', () => hands.filter((h) => !isComplete(h, replay(h))).length);
  await time('início: ordenar e agrupar por dia', () => [...hands].sort((a, b) => b.createdAt - a.createdAt).length);
  await time('início: para rever', () => hands.filter((h) => needsReview(h)).length);
  const br = ensureBankrolls(boot.bankrolls.items, sessions, '€');
  const scope = { bankrollId: 'br1' };
  await time('bankroll: ecrã completo', () => {
    const list = applyFilter(sessionsIn(scope, sessions, br), { game: 'all', format: 'all', stakes: [], range: {} } as never);
    balanceOf(scope, sessions, boot.transfers.items, br);
    totals(list, '€');
    winRate(cashDone(list, '€'));
    verdict(list, '€', String);
    const pts = curve(list, '€').map((p) => p.v);
    drawdown(pts);
    lastResults(list, 5);
    ledger(list, boot.transfers.items);
    dailyResults(list);
    bestWeekday(list);
  });
  await time('bankroll: insights', () => insights(sessions, String));
  await time('bankroll: quedas (downswings)', () => downswings(sessions, '€'));
  await time('win rate por jogo', () => winRateBy(cashDone(sessions, '€'), 'game' as never, '€'));
  await time('torneios: estatísticas', () => summarize(finishedTourneys(sessions, '€').list, 'all' as never));
  await time('jogadores: contagem de mãos', () => handCounts(hands, boot.players.items));
  await time('jogadores: estatísticas de adversários', () => opponentStats(hands, boot.players.items));
  await time('staking: pacotes', () => packageStates(sessions, boot.packages.items));
  return out;
}

if (process.argv[1]?.endsWith('perf-bench.ts')) {
  bench().then((r) => {
    for (const [k, v] of Object.entries(r)) console.log(`${String(v).padStart(8)} ms  ${k}`);
  });
}
