// "Experimenta nestes dias": during the free trial, three Pro things picked
// for this player, each one tap away. Most short trials are turned off on day
// 0 or 1 (RevenueCat, State of Subscription Apps 2026), usually before the
// player has opened anything Pro; this puts the Pro screens in reach while
// the days last. Pure picking here; TrialTries shows it.
//
// Only what works from where the player is: insights and variance need
// enough sessions to say anything, so they're offered only then.

import { isMtt, type Answers } from './onboarding';

export type TryKey = 'staking' | 'mttStats' | 'insights' | 'homeTotal' | 'voiceHand' | 'varianceMine' | 'hands';

/** Portuguese keys; show with t(). */
export const TRIES: Record<TryKey, { icon: string; title: string; body: string; route: string }> = {
  staking: {
    icon: 'people',
    title: 'Junta um backer',
    body: 'O makeup e o saldo fazem-se sozinhos',
    route: '/staking',
  },
  mttStats: {
    icon: 'trophy',
    title: 'Vê o ROI por buy-in',
    body: 'E o ITM por festival e jogo',
    route: '/tournament-stats',
  },
  insights: {
    icon: 'bulb',
    title: 'Vê onde ganhas e onde perdes',
    body: 'Salas, stakes, dias e horas',
    route: '/bankroll',
  },
  homeTotal: {
    icon: 'globe',
    title: 'Junta as tuas moedas',
    body: 'Tudo numa só, ao câmbio de cada dia',
    route: '/bankroll',
  },
  voiceHand: {
    icon: 'mic',
    title: 'Conta uma mão em voz alta',
    body: 'Toca no microfone ao registar a mão',
    route: '/hand/new',
  },
  varianceMine: {
    icon: 'pulse',
    title: 'Vê a tua variância',
    body: 'Com o teu win rate, já preenchido',
    route: '/variance',
  },
  hands: {
    icon: 'infinite',
    title: 'Guarda todas as mãos da sessão',
    body: 'Sem limite diário',
    route: '/hand/new',
  },
};

/** Sessions before insights and variance have something to show (insights-math needs 5 a side). */
export const DATA_SESSIONS = 10;

export interface TryData {
  /** Finished sessions. */
  sessions: number;
  /** Finished tournament sessions. */
  mtt: number;
  /** Currencies the player's sessions are in. */
  currencies: number;
  /** Backers already set up (from an earlier Pro, kept). */
  backers: number;
}

/** Three Pro things for this player, most useful first. */
export function triesFor(a: Answers | null | undefined, d: TryData): TryKey[] {
  const goals = a?.goals ?? [];
  const out: TryKey[] = [];
  const add = (k: TryKey, when: boolean) => when && !out.includes(k) && out.push(k);
  add('staking', goals.includes('backers') || a?.plays === 'cash4' || a?.plays === 'mtt3' || d.backers > 0);
  add('mttStats', isMtt(a?.plays) || d.mtt > 0);
  add('insights', d.sessions >= DATA_SESSIONS);
  add('homeTotal', d.currencies > 1);
  add('voiceHand', true);
  add('varianceMine', d.sessions >= DATA_SESSIONS);
  add('hands', true);
  return out.slice(0, 3);
}

export interface TriesState {
  /** The trial these belong to (its start); a new trial starts a fresh list. */
  start: number;
  done: TryKey[];
}

/** The list for this trial: what's done carries over only within the same trial. */
export function forTrial(saved: TriesState | null, start: number): TriesState {
  return saved && saved.start === start ? saved : { start, done: [] };
}

/** Whether the card shows: in a trial that hasn't ended, with something left to try, and not hidden for this trial. */
export function showTries(trial: { start: number; end: number } | null, s: TriesState, keys: TryKey[], hiddenFor: number | null, now: number): boolean {
  if (!trial || now >= trial.end) return false;
  if (hiddenFor === trial.start) return false;
  return keys.some((k) => !s.done.includes(k));
}
