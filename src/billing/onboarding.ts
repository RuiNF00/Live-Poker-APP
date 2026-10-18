// First-run quiz: one question per screen, then a plan built from the
// answers, then the paywall (Mobbin notes, rules 3 and 5). The answers stay
// on the phone; only the currency changes a setting.

/** Set once the first-run flow was shown; holds the answers. */
export const ONBOARDING_KEY = 'rl.onboarding.v1';

export type Goal = 'results' | 'leaks' | 'backers' | 'discuss';
export type Plays = 'cash1' | 'cash2' | 'cash3' | 'cash4' | 'mtt1' | 'mtt2' | 'mtt3';
export type Volume = 'few' | 'some' | 'lots';

export interface Answers {
  goals: Goal[];
  plays: Plays | null;
  volume: Volume | null;
}

/** Portuguese keys; show with t(). */
export const GOALS: { key: Goal; icon: string; label: string }[] = [
  { key: 'results', icon: 'trending-up', label: 'Ver os meus resultados' },
  { key: 'leaks', icon: 'search', label: 'Encontrar leaks' },
  { key: 'backers', icon: 'people', label: 'Gerir backers' },
  { key: 'discuss', icon: 'chatbubbles', label: 'Guardar mãos para discutir' },
];

/** The whole ladder, up to the high stakes the app is built for. `label` is a Portuguese key for the plan screen. */
export const PLAYS: { key: Plays; group: 'Cash' | 'Torneios'; stakes: string; label: string }[] = [
  { key: 'cash1', group: 'Cash', stakes: '1/2 – 2/5', label: 'Cash 1/2 a 2/5' },
  { key: 'cash2', group: 'Cash', stakes: '3/5 – 5/10', label: 'Cash 3/5 a 5/10' },
  { key: 'cash3', group: 'Cash', stakes: '10/20 – 25/50', label: 'Cash 10/20 a 25/50' },
  { key: 'cash4', group: 'Cash', stakes: '50/100+', label: 'Cash 50/100 ou mais' },
  { key: 'mtt1', group: 'Torneios', stakes: '< 1.000', label: 'Torneios até 1.000 de buy-in' },
  { key: 'mtt2', group: 'Torneios', stakes: '1.000 – 5.000', label: 'Torneios de 1.000 a 5.000' },
  { key: 'mtt3', group: 'Torneios', stakes: '5.000+', label: 'Torneios acima de 5.000' },
];

/** Tournament player? Also reads answers saved before the ladder (mttLow, mttHigh). */
export const isMtt = (p: string | null | undefined) => !!p && p.startsWith('mtt');

/** Currencies offered on first run, with a name so "$" isn't ambiguous. `code` is what's stored. */
export const FIRST_CURRENCIES: { code: string; sym: string; name: string }[] = [
  { code: '€', sym: '€', name: 'Euro' },
  { code: '$', sym: 'US$', name: 'Dólar americano' },
  { code: '£', sym: '£', name: 'Libra' },
  { code: 'R$', sym: 'R$', name: 'Real' },
  { code: 'CHF', sym: 'CHF', name: 'Franco suíço' },
  { code: 'HK$', sym: 'HK$', name: 'Dólar de Hong Kong' },
  { code: 'A$', sym: 'A$', name: 'Dólar australiano' },
];

export const VOLUMES: { key: Volume; label: string }[] = [
  { key: 'few', label: 'Até 4 por mês' },
  { key: 'some', label: '5 a 10 por mês' },
  { key: 'lots', label: 'Mais de 10 por mês' },
];

/** What the plan screen promises, in Portuguese keys. Every point is something the app does today. */
export function planFor(a: Answers): { title: string; points: string[]; pro: string[] } {
  const mtt = isMtt(a.plays);
  const title = mtt ? 'O teu caderno de torneios' : a.plays ? 'O teu caderno de cash' : 'O teu caderno de póquer live';
  const points: string[] = [];
  const add = (p: string) => !points.includes(p) && points.push(p);
  for (const g of a.goals) {
    if (g === 'results') add(mtt ? 'Bankroll, ROI e ITM por sala' : 'Bankroll e ganho por hora, por sala');
    if (g === 'leaks') add('Cada mão revista rua a rua no replayer');
    if (g === 'backers') add('Staking: quanto deves a cada backer, com makeup');
    if (g === 'discuss') add('Um link por mão para os amigos votarem');
  }
  add('Mãos registadas em segundos, entre mãos');
  if (mtt) add('Planeador de festivais, com lembretes de late reg');
  return { title, points: points.slice(0, 4), pro: proFor(a) };
}

/** What Pro adds for this profile: two lines, each a real Pro feature (see freeVsPro). */
function proFor(a: Answers): string[] {
  const out: string[] = [];
  if (a.volume === 'lots' || a.volume === 'some') out.push('Mãos sem limite: o grátis fica pelas 3 por dia');
  if (a.goals.includes('results')) out.push('Filtros por sala, jogo e stake, e CSV');
  if (a.goals.includes('backers') || a.plays === 'cash4' || a.plays === 'mtt3') out.push('Uma bankroll por moeda ou por backer');
  if (a.goals.includes('discuss') || a.goals.includes('leaks')) out.push('Várias mãos de uma vez para o solver');
  out.push('Mãos sem limite: o grátis fica pelas 3 por dia', 'Stories com voz, sem marca de água');
  return [...new Set(out)].slice(0, 2);
}

export type StartStep = 'hand' | 'session' | 'bankroll' | 'festival' | 'share';

/** The first-week checklist on the hands list. Portuguese keys; show with t(). */
export const START_STEPS: { key: StartStep; label: string }[] = [
  { key: 'hand', label: 'Guarda 3 mãos' },
  { key: 'session', label: 'Regista uma sessão' },
  { key: 'bankroll', label: 'Define o bankroll inicial' },
  { key: 'share', label: 'Partilha uma mão com um amigo' },
];

/** Four steps, by what they play: tournament players plan a festival instead of setting the bankroll first. */
export function startSteps(plays: string | null | undefined): { key: StartStep; label: string }[] {
  if (!isMtt(plays)) return START_STEPS;
  return [
    { key: 'hand', label: 'Guarda 3 mãos' },
    { key: 'session', label: 'Regista um torneio' },
    { key: 'festival', label: 'Escolhe os torneios do próximo festival' },
    { key: 'share', label: 'Partilha uma mão com um amigo' },
  ];
}

/**
 * Tournaments picked across every festival plan. The step's button opens the festival that
 * starts first (an own one, or the soonest shipped), so picks on any festival count.
 */
export function festivalPicks(plans: Record<string, { picked?: string[] } | undefined>): number {
  return Object.values(plans).reduce((n, p) => n + (p?.picked?.length ?? 0), 0);
}

export function startProgress(s: { hands: { shareId?: string }[]; sessions: number; deposits: number; festivalPicks?: number }): Record<StartStep, boolean> {
  return {
    hand: s.hands.length >= 3,
    session: s.sessions > 0,
    bankroll: s.deposits > 0,
    festival: (s.festivalPicks ?? 0) > 0,
    share: s.hands.some((h) => !!h.shareId),
  };
}
