// First-run quiz: one question per screen, then a plan built from the
// answers, then the paywall (Mobbin notes, rules 3 and 5). The answers stay
// on the phone; only the currency changes a setting.

/** Set once the first-run flow was shown; holds the answers. */
export const ONBOARDING_KEY = 'rl.onboarding.v1';

export type Goal = 'results' | 'leaks' | 'backers' | 'discuss';
export type Plays = 'cashLow' | 'cashHigh' | 'mttLow' | 'mttHigh';
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

export const PLAYS: { key: Plays; label: string; sub: string }[] = [
  { key: 'cashLow', label: 'Cash', sub: 'Até 2/5' },
  { key: 'cashHigh', label: 'Cash', sub: '5/10 ou mais' },
  { key: 'mttLow', label: 'Torneios', sub: 'Buy-in até 1.000' },
  { key: 'mttHigh', label: 'Torneios', sub: 'Buy-in acima de 1.000' },
];

export const VOLUMES: { key: Volume; label: string }[] = [
  { key: 'few', label: 'Até 4 por mês' },
  { key: 'some', label: '5 a 10 por mês' },
  { key: 'lots', label: 'Mais de 10 por mês' },
];

/** What the plan screen promises, in Portuguese keys. Every point is something the app does today. */
export function planFor(a: Answers): { title: string; points: string[] } {
  const mtt = a.plays === 'mttLow' || a.plays === 'mttHigh';
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
  if (a.volume === 'lots') add('Mãos sem limite em todas as sessões');
  return { title, points: points.slice(0, 4) };
}

export type StartStep = 'hand' | 'session' | 'bankroll' | 'share';

/** The first-week checklist on the hands list. Portuguese keys; show with t(). */
export const START_STEPS: { key: StartStep; label: string }[] = [
  { key: 'hand', label: 'Guarda 3 mãos' },
  { key: 'session', label: 'Regista uma sessão' },
  { key: 'bankroll', label: 'Define o bankroll inicial' },
  { key: 'share', label: 'Partilha uma mão com um amigo' },
];

export function startProgress(s: { hands: { shareId?: string }[]; sessions: number; deposits: number }): Record<StartStep, boolean> {
  return {
    hand: s.hands.length >= 3,
    session: s.sessions > 0,
    bankroll: s.deposits > 0,
    share: s.hands.some((h) => !!h.shareId),
  };
}
