// What the home-screen widget shows: the running session when there is one,
// otherwise this week's result and the logging streak. Pure, so the tests run
// in plain Node and iOS and Android render the same numbers.

import { t } from '@/i18n';
import { duration, money } from '@/poker/format';
import { playedMs, profit } from '@/store/session-math';
import { computeStreak, weekStart, type Pause } from '@/store/streak';
import type { Session } from '@/store/types';

import { liveProps } from '../lock-screen/live-state';

/** Plain JSON: the layouts run in the widget's own JS runtime. */
export interface WidgetProps {
  live: boolean;
  // Running session (live = true)
  title: string;
  status: string;
  paused: boolean;
  clockFrom: number;
  pausedAt: number;
  since: string;
  played: string;
  stack: string;
  stackBB: string;
  level: string;
  blinds: string;
  // No session (live = false)
  week: string;
  /** "+$1,240", "−$300", "•••" with amounts hidden, "—" with nothing played. */
  result: string;
  tone: 'up' | 'down' | 'flat';
  weekSub: string;
  streak: string;
  streakOn: boolean;
  labels: { time: string; stack: string; newHand: string };
}

export interface WidgetInput {
  activeSession: Session | null;
  sessions: Session[];
  hands: { createdAt: number }[];
  players: { updatedAt: number }[];
  currency: string;
  hideAmounts: boolean;
  streakPauses: Pause[];
}

export function widgetProps(x: WidgetInput, now = Date.now()): WidgetProps {
  const s = x.activeSession;
  const lp = s ? liveProps(s, now) : null;

  // This week, in the main currency: other currencies don't add up.
  const from = weekStart(now);
  const week = x.sessions.filter((v) => v.endedAt && v.startedAt >= from && v.currency === x.currency);
  const net = week.reduce((a, v) => a + profit(v), 0);
  const hours = week.reduce((a, v) => a + playedMs(v, v.endedAt), 0);
  const result = !week.length ? '—' : x.hideAmounts ? '•••' : (net > 0 ? '+' : '') + money(net, x.currency);

  const activity = [...x.hands.map((h) => h.createdAt), ...x.sessions.filter((v) => v.notes.trim()).map((v) => v.startedAt), ...x.players.map((p) => p.updatedAt)];
  const st = computeStreak(activity, x.streakPauses, now);

  return {
    live: !!lp,
    title: lp?.title ?? '',
    status: lp?.status ?? '',
    paused: lp?.paused ?? false,
    clockFrom: lp?.clockFrom ?? 0,
    pausedAt: lp?.pausedAt ?? 0,
    since: lp?.since ?? '',
    played: lp?.played ?? '',
    stack: lp?.stack ?? '',
    stackBB: lp?.stackBB ?? '',
    level: lp?.level ?? '',
    blinds: lp?.blinds ?? '',
    week: t('Esta semana'),
    result,
    tone: !week.length || x.hideAmounts || net === 0 ? 'flat' : net > 0 ? 'up' : 'down',
    weekSub: !week.length
      ? t('Sem sessões ainda')
      : (week.length === 1 ? t('1 sessão') : t('{n} sessões', { n: week.length })) + ' · ' + duration(hours),
    streak: st.weeks === 1 ? t('1 semana seguida') : t('{n} semanas seguidas', { n: st.weeks }),
    streakOn: st.loggedThisWeek && !st.paused,
    labels: { time: t('Tempo'), stack: 'Stack', newHand: t('Nova mão') },
  };
}
