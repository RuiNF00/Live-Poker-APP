// What a five-year history costs in the screens: npm run bench:history
// 2 000 sessions and 20 000 hands (scripts/big-history), timed through the pure functions the
// Resumo, Mãos, Bankroll and Exportar screens run. Each figure is the median of several runs on
// this machine; a mid-range phone is roughly 4 to 6 times slower.

import { performance } from 'node:perf_hooks';

import { handsCsv } from '../src/export/report';
import { dueAgainCount } from '../src/poker/drill';
import { needsReview } from '../src/poker/review';
import { replay } from '../src/poker/engine';
import { buildBackup, sessionsCsv } from '../src/store/backup';
import { handSearchText, matchesSearch, parseSearch } from '../src/store/hand-filters';
import { insights } from '../src/store/insights-math';
import { monthRecap, monthKey } from '../src/store/month-recap';
import { verdict } from '../src/store/results-math';
import { computeStreak, streakActivity, weekStart } from '../src/store/streak';
import { bigSessionsAndHands } from './big-history';

const NOW = Date.UTC(2026, 9, 29, 20);

function median(fn: () => unknown, runs = 7): number {
  fn();
  const t: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    t.push(performance.now() - t0);
  }
  return t.sort((a, b) => a - b)[runs >> 1];
}
const f = (ms: number) => (ms < 1 ? ms.toFixed(2) : ms.toFixed(1)).padStart(7) + ' ms';

const { sessions, hands, players } = bigSessionsAndHands();
const rows: [string, number][] = [];
const run = (label: string, fn: () => unknown, runs?: number) => rows.push([label, median(fn, runs)]);

run('Resumo: série de semanas', () => computeStreak(streakActivity(hands, sessions, players), [], NOW));
run('Resumo: mãos desta semana', () => {
  const since = weekStart(NOW);
  return hands.filter((h) => h.createdAt >= since).length;
});
run('Resumo: por rever e para treinar', () => {
  const sent = new Set<string>();
  hands.filter((h) => needsReview(h, sent));
  return dueAgainCount(hands, {}, NOW);
});
run('Resumo: mês e veredicto', () => [monthRecap(sessions, monthKey(NOW)), verdict(sessions, 'EUR', String)]);
run('Bankroll: padrões', () => insights(sessions, String));
const text = new Map(hands.map((h) => [h, handSearchText(h)]));
run('Mãos: pesquisa «bel» (texto já feito)', () => hands.filter((h) => matchesSearch(h, parseSearch('bel'), text.get(h)!)).length);
run('Mãos: texto da pesquisa, 1.ª vez', () => hands.map(handSearchText).length, 3);
run('Mãos: repetir cada mão, 1.ª vez', () => hands.map((h) => replay(h)).length, 3);
run('Exportar: mãos em CSV', () => handsCsv(hands, sessions).length, 3);
run('Exportar: sessões em CSV', () => sessionsCsv(sessions).length, 3);
run('Exportar: cópia de segurança', () => JSON.stringify(buildBackup({ hands, sessions, players, settings: {} } as never)).length, 3);

console.log(`${sessions.length} sessões, ${hands.length} mãos, ${players.length} jogadores\n`);
for (const [label, ms] of rows) console.log(`${f(ms)}  ${label}`);
