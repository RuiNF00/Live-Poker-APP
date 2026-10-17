// "Onde ganhas e onde perdes": plain sentences from the player's own
// sessions (hourly by session length, weekday, time of day, venue, stakes,
// and the session after a big loss). Pure, so it can be tested.
//
// An insight only exists when both sides of the comparison have enough
// sessions and hours behind them; every one carries its sample so the screen
// can show it. Poker variance is large: a card from 6 sessions would be noise.

import { t } from '@/i18n';

import { stakeKey, stakeLabel } from './bankroll-math';
import { cost, playedMs, profit } from './session-math';
import type { Session } from './types';

/** Fewest sessions on each side of a comparison. */
export const MIN_SESSIONS = 5;
/** Fewest hours on each side of an hourly comparison. */
export const MIN_HOURS = 15;
const H = 3600000;

export interface Group {
  label: string;
  sessions: number;
  hours: number;
  profit: number;
  /** Per hour (or per session for tournaments-only groups, see `unit`). */
  rate: number;
}

export interface Insight {
  id: 'length' | 'weekday' | 'daytime' | 'venue' | 'stakes' | 'tilt';
  /** The verdict, one sentence. */
  title: string;
  /** What it is based on. */
  detail: string;
  tone: 'good' | 'bad';
  /** Bars to draw, best to worst or in natural order. */
  groups: Group[];
  unit: 'hour' | 'session';
  sample: { sessions: number; hours: number };
}

export interface InsightOptions {
  /**
   * A session's result. Defaults to `profit`; the Swaps thread passes one that
   * adds swap settlements when the player turns that on.
   */
  result?: (s: Session) => number;
}

function group(label: string, list: Session[], result: (s: Session) => number, unit: 'hour' | 'session'): Group {
  const hours = list.reduce((a, s) => a + playedMs(s), 0) / H;
  const p = list.reduce((a, s) => a + result(s), 0);
  return { label, sessions: list.length, hours, profit: p, rate: unit === 'hour' ? (hours > 0 ? p / hours : 0) : list.length ? p / list.length : 0 };
}

const enough = (g: Group, unit: 'hour' | 'session') => g.sessions >= MIN_SESSIONS && (unit === 'session' || g.hours >= MIN_HOURS);

/** How far apart two rates are, relative to the larger: what orders the cards. */
function gapOf(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9);
}

/** "40%" of the gap between two rates, relative to the better one. */
function pctDrop(better: number, worse: number): number {
  return Math.round((Math.abs(better - worse) / Math.max(Math.abs(better), 1e-9)) * 100);
}

function sample(groups: Group[]) {
  return { sessions: groups.reduce((a, g) => a + g.sessions, 0), hours: groups.reduce((a, g) => a + g.hours, 0) };
}

function byKey(list: Session[], key: (s: Session) => string | null): Map<string, Session[]> {
  const m = new Map<string, Session[]>();
  for (const s of list) {
    const k = key(s);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), s]);
  }
  return m;
}

/** Best and worst of the groups with enough data; null with fewer than two or no real gap. */
function bestWorst(groups: Group[], unit: 'hour' | 'session'): [Group, Group] | null {
  const ok = groups.filter((g) => enough(g, unit)).sort((a, b) => b.rate - a.rate);
  if (ok.length < 2) return null;
  const best = ok[0];
  const worst = ok[ok.length - 1];
  return best.rate - worst.rate > 0 ? [best, worst] : null;
}

const WEEKDAYS = () => [t('domingo'), t('segunda'), t('terça'), t('quarta'), t('quinta'), t('sexta'), t('sábado')];

/** Part of the day a session started in, as it reads after "começam" ("de manhã", "à noite"). */
function daytime(ts: number): string {
  const h = new Date(ts).getHours();
  return h < 6 ? t('de madrugada') : h < 12 ? t('de manhã') : h < 18 ? t('à tarde') : t('à noite');
}

/**
 * Insights for finished sessions in one currency (the caller has already
 * scoped and filtered them), strongest gap first.
 */
export function insights(all: Session[], money: (n: number) => string, opts: InsightOptions = {}): Insight[] {
  const result = opts.result ?? profit;
  const done = all.filter((s) => s.endedAt && playedMs(s) > 0);
  const cash = done.filter((s) => s.kind === 'cash');
  // Hourly comparisons use cash when there's enough of it; a tournament
  // player's day is better judged per tournament.
  const useCash = cash.length >= 2 * MIN_SESSIONS;
  const base = useCash ? cash : done.filter((s) => s.kind === 'mtt');
  const unit: 'hour' | 'session' = useCash ? 'hour' : 'session';
  const rate = (g: Group) => (unit === 'hour' ? t('{amount}/h', { amount: money(g.rate) }) : t('{amount} por torneio', { amount: money(g.rate) }));
  const out: (Insight & { gap: number })[] = [];
  const push = (i: Insight, gap: number) => out.push({ ...i, gap });

  // Session length: cash only (a tournament's length is decided by the cards).
  if (cash.length) {
    const short = group(t('Até 6 h'), cash.filter((s) => playedMs(s) <= 6 * H), result, 'hour');
    const long = group(t('Mais de 6 h'), cash.filter((s) => playedMs(s) > 6 * H), result, 'hour');
    if (enough(short, 'hour') && enough(long, 'hour') && short.rate !== long.rate) {
      const longWorse = long.rate < short.rate;
      const drop = pctDrop(longWorse ? short.rate : long.rate, longWorse ? long.rate : short.rate);
      push(
        {
          id: 'length',
          // A % of a negative rate reads as nonsense ("cai 200%"): those cases get words instead.
          title: longWorse
            ? short.rate <= 0
              ? t('Depois das 6 horas perdes ainda mais por hora.')
              : long.rate < 0
                ? t('Depois das 6 horas passas a perder dinheiro.')
                : t('Depois das 6 horas o que ganhas por hora cai {pct}%.', { pct: drop })
            : long.rate < 0
              ? t('Depois das 6 horas perdes menos por hora.')
              : short.rate <= 0
                ? t('Rendes mais em sessões de mais de 6 horas.')
              : t('Rendes mais em sessões longas: +{pct}% por hora depois das 6 horas.', { pct: drop }),
          detail: t('{a}: {ra} · {b}: {rb}', { a: short.label, ra: t('{amount}/h', { amount: money(short.rate) }), b: long.label, rb: t('{amount}/h', { amount: money(long.rate) }) }),
          tone: longWorse ? 'bad' : 'good',
          groups: [short, long],
          unit: 'hour',
          sample: sample([short, long]),
        },
        gapOf(short.rate, long.rate),
      );
    }
  }

  const dimension = (id: Insight['id'], key: (s: Session) => string | null, label: (k: string) => string, phrase: (best: Group, worst: Group) => string, order?: string[]) => {
    const groups = [...byKey(base, key).entries()].map(([k, l]) => group(label(k), l, result, unit));
    const bw = bestWorst(groups, unit);
    if (!bw) return;
    const [best, worst] = bw;
    const shown = groups.filter((g) => enough(g, unit));
    if (order) shown.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    else shown.sort((a, b) => b.rate - a.rate);
    push(
      {
        id,
        title: phrase(best, worst),
        detail: t('{best}: {rb} · {worst}: {rw}', { best: best.label, rb: rate(best), worst: worst.label, rw: rate(worst) }),
        tone: worst.rate < 0 ? 'bad' : 'good',
        groups: shown,
        unit,
        sample: sample(shown),
      },
      gapOf(best.rate, worst.rate),
    );
  };

  const days = WEEKDAYS();
  dimension(
    'weekday',
    (s) => String(new Date(s.startedAt).getDay()),
    (k) => days[Number(k)],
    (b, w) => (b.rate < 0 ? t('Perdes dinheiro em todos os dias; o pior é {worst} e o menos mau {best}.', { best: b.label, worst: w.label }) : w.rate < 0 ? t('Perdes dinheiro nas sessões de {worst}; {best} é o teu melhor dia.', { worst: w.label, best: b.label }) : t('{best} é o teu melhor dia; {worst} o pior.', { best: b.label, worst: w.label })),
    [1, 2, 3, 4, 5, 6, 0].map((d) => days[d]),
  );
  const parts = [t('de manhã'), t('à tarde'), t('à noite'), t('de madrugada')];
  dimension(
    'daytime',
    (s) => daytime(s.startedAt),
    (k) => k,
    (b, w) => (b.rate < 0 ? t('As sessões que começas {worst} são as que dão mais prejuízo; nas que começas {best} perdes menos.', { worst: w.label, best: b.label }) : w.rate < 0 ? t('As sessões que começas {worst} dão prejuízo; as que começas {best} rendem mais.', { worst: w.label, best: b.label }) : t('Rendes mais nas sessões que começas {best}.', { best: b.label })),
    parts,
  );
  dimension(
    'venue',
    (s) => (s.venue || '').trim() || null,
    (k) => k,
    (b, w) => (b.rate < 0 ? t('Perdes dinheiro em todas as salas; em {best} perdes menos.', { best: b.label }) : w.rate < 0 ? t('Perdes dinheiro em {worst}; {best} é a sala onde rendes mais.', { worst: w.label, best: b.label }) : t('{best} é a sala onde rendes mais.', { best: b.label })),
  );
  const cur = base[0]?.currency ?? '€';
  dimension(
    'stakes',
    (s) => stakeKey(s),
    (k) => stakeLabel(k, cur),
    (b, w) => (b.rate < 0 ? t('Perdes dinheiro em todas as stakes; a {best} perdes menos.', { best: b.label }) : w.rate < 0 ? t('Perdes dinheiro a {worst}; a {best} rendes mais.', { worst: w.label, best: b.label }) : t('Rendes mais a {best}.', { best: b.label })),
  );

  // After a big loss (more than 3 of the player's usual buy-ins): the next
  // session, if it started within 2 days, against every other session.
  const sorted = [...done].sort((a, b) => a.startedAt - b.startedAt);
  const avgCost = sorted.reduce((a, s) => a + cost(s), 0) / Math.max(1, sorted.length);
  if (avgCost > 0) {
    const after: Session[] = [];
    const rest: Session[] = [];
    sorted.forEach((s, i) => {
      const prev = sorted[i - 1];
      const tilt = !!prev && result(prev) <= -3 * avgCost && s.startedAt - (prev.endedAt ?? prev.startedAt) < 48 * H;
      (tilt ? after : rest).push(s);
    });
    const a = group(t('Após perda'), after, result, 'session');
    const r = group(t('Outras'), rest, result, 'session');
    if (enough(a, 'session') && enough(r, 'session') && a.rate < r.rate) {
      push(
        {
          id: 'tilt',
          title:
            r.rate <= 0
              ? t('A seguir a uma perda grande, perdes ainda mais.')
              : a.rate < 0
                ? t('Na sessão a seguir a uma perda grande, perdes dinheiro.')
                : t('A seguir a uma perda grande, rendes {pct}% menos.', { pct: pctDrop(r.rate, a.rate) }),
          detail: t('Perda grande: mais de 3 buy-ins ({amount}). A sessão seguinte, até 2 dias depois.', { amount: money(3 * avgCost) }),
          tone: 'bad',
          groups: [a, r],
          unit: 'session',
          sample: sample([a, r]),
        },
        // Tilt is worth seeing even when the gap is modest.
        gapOf(r.rate, a.rate) * 2,
      );
    }
  }

  return out.sort((a, b) => b.gap - a.gap).map(({ gap: _, ...i }) => i);
}
