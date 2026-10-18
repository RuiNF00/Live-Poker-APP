// Times the bankroll screens with five years of heavy data (see heavy-seed.ts):
// win rate, variance, downswing odds, "Posso subir de stake?", the monthly and
// yearly recaps and the multi-currency total. Same seed and budgets as
// perf-bench.ts.
//
//   npx tsx src/store/__tests__/perf-bankroll.ts

import { cachedPotBB, handsOfYear, yearCards, yearReview } from '@/share/year-review';
import { balanceOf } from '@/store/bankroll-math';
import { homeTotals, type RateTable } from '@/store/fx-math';
import { compareMonths, defaultMonth, monthRecap, recapMonths } from '@/store/month-recap';
import { currentStake, moveUp, riskOfRuin, withdrawable } from '@/store/moveup-math';
import { cashStats, downswingOdds, downswings, mttStats, usualBuyIn } from '@/store/results-math';
import { mainCurrency, profit } from '@/store/session-math';
import { cashDone, hoursToKnow, winRate, winRateBy } from '@/store/winrate-math';

import { HEAVY_NOW, heavyData } from './heavy-seed';

export function benchBankroll() {
  const out: Record<string, number> = {};
  const time = <T>(name: string, f: () => T): T => {
    const t0 = performance.now();
    const r = f();
    out[name] = +(performance.now() - t0).toFixed(1);
    return r;
  };
  const d = heavyData();
  const { sessions, transfers, bankrolls } = d;
  const cur = mainCurrency(sessions.filter((s) => s.endedAt));
  time('win rate: ecrã (IC, horas para saber, por jogo/sala)', () => {
    const cash = cashDone(sessions, cur);
    const w = winRate(cash);
    if (w) hoursToKnow(w);
    winRateBy(cash, 'game' as never, cur);
    winRateBy(cash, 'venue' as never, cur);
  });
  time('variância: cash e torneios', () => {
    cashStats(sessions, cur);
    mttStats(sessions, cur);
  });
  time('downswings: lista + probabilidades (1000 simulações)', () => {
    const done = sessions.filter((s) => s.endedAt && s.currency === cur);
    downswings(done, cur);
    downswingOdds(done.map(profit));
    usualBuyIn(done, cur);
  });
  time('posso subir de stake: stake, risco de ruína, levantar', () => {
    const b = bankrolls[0];
    const mine = sessions.filter((s) => (s.bankrollId ?? b.id) === b.id);
    const bal = balanceOf({ bankrollId: b.id }, sessions, transfers, bankrolls).balance;
    const st = currentStake(mine, HEAVY_NOW);
    const w = winRate(cashDone(mine, b.currency));
    if (st && w) riskOfRuin(bal, st, w);
    if (st) moveUp(bal, st, { cashBuyIns: 30 });
    withdrawable(bal, mine, { cashBuyIns: 30, mttBuyIns: 100 }, HEAVY_NOW);
  });
  time('resumo do mês: ecrã (mês, comparação, meses)', () => {
    const k = defaultMonth(sessions, HEAVY_NOW)!;
    recapMonths(sessions);
    const r = monthRecap(sessions, k);
    compareMonths(sessions, k, r.currency);
  });
  // The year screen draws without the biggest pot, warms the pot cache in slices (not timed: off the first frame), then redraws.
  time('o meu ano: primeiro ecrã', () => yearCards(yearReview(2026, sessions, d.hands, [], [], { pot: false })));
  handsOfYear(d.hands, 2026).forEach(cachedPotBB);
  time('o meu ano: com o maior pote', () => yearCards(yearReview(2026, sessions, d.hands)));
  const rates: RateTable = {};
  for (let t = HEAVY_NOW - 5 * 366 * 86400000; t <= HEAVY_NOW; t += 86400000) rates[new Date(t).toISOString().slice(0, 10)] = { USD: 1.1, GBP: 0.85 };
  time('património em várias moedas', () => homeTotals({ sessions, transfers, bankrolls }, '€', rates, { from: Date.UTC(2026, 0, 1) }, HEAVY_NOW));
  return out;
}

if (process.argv[1]?.endsWith('perf-bankroll.ts')) {
  const r = benchBankroll();
  for (const [k, v] of Object.entries(r)) console.log(`${String(v).padStart(8)} ms  ${k}`);
}
