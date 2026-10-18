// One tap from a planned festival event to a running session, from the
// festival planner or the Sessão tab: a new session, a re-entry on a later
// flight, or Day 2 picking up the bagged one.

import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { t } from '@/i18n';
import { syncFestivalReminders } from '@/lib/festival-reminders';
import { kindOn } from '@/lib/notify-policy';
import { eventTitle, type Festival, type FestivalEvent } from '@/poker/festivals';
import { getOffers, stakesFor } from '@/store/action-offer';
import { eventAction, getPlan, levelStart, updatePlan } from '@/store/festival-plan';
import { reenterFlight, resumeDay } from '@/store/multi-day';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';

import { blankSession } from './SessionForm';
import { tap } from './ui';

export function sessionName(e: FestivalEvent) {
  return eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '');
}

/** A running tournament session for a festival event, starting now. */
export function sessionFromEvent(f: Festival, e: FestivalEvent, tableSize: number, bankrollId: string | undefined, now = Date.now()): Session {
  const base = blankSession('mtt', f.currency, tableSize);
  return {
    ...base,
    name: sessionName(e),
    // An own festival has no city: just the venue, without a trailing comma.
    venue: [f.venue, f.city && t(f.city.split(',')[0])].filter(Boolean).join(', '),
    buyIn: e.buyIn,
    bankrollId,
    // Backers who bought a piece of this event through an action package.
    stakes: stakesFor(getOffers(), f.id, e.id),
    // The published starting stack and level length, when known: nothing to type, and the level clock runs.
    stack: e.stack ?? base.stack,
    levelMinutes: e.levelMinutes,
    // Started before the clock does (the reminder comes 30 min early): level 1 runs from the published start.
    levelStartedAt: levelStart(f, e, now),
    tourney: e.stack ? { startStack: e.stack } : undefined,
    startedAt: now,
    stackLog: [{ t: now, stack: e.stack ?? base.stack, level: base.level }],
  };
}

export function useStartEvent() {
  const { sessions, bankrolls, defaultBankroll, activeSession, saveSession, settings } = useStore();
  /** `ended`: the session just ended in the same tap ("Próximo do plano"), not saved in the store yet. */
  return (f: Festival, e: FestivalEvent, ended?: Session) => {
    const plan = getPlan(f.id);
    const all = ended ? sessions.map((x) => (x.id === ended.id ? ended : x)) : sessions;
    const a = eventAction(f, plan, all, e);
    if (!a) return;
    if (a.kind === 'view') return router.push('/session');
    if (activeSession && activeSession.id !== ended?.id) {
      const msg = t('Termina a sessão "{name}" antes de começar outra.', { name: activeSession.name || t('Sessão') });
      if (Platform.OS === 'web') router.push('/session');
      else Alert.alert(t('Já tens uma sessão a decorrer'), msg, [{ text: t('Ver sessão'), onPress: () => router.push('/session') }, { text: t('Cancelar'), style: 'cancel' }]);
      return;
    }
    tap('medium');
    // The bankroll in the festival's currency, if there is one.
    const bankroll = bankrolls.find((b) => b.currency === f.currency) ?? defaultBankroll;
    const s =
      a.kind === 'resume'
        ? resumeDay(a.session)
        : a.kind === 'reenter'
          ? reenterFlight(a.session, sessionName(e))
          : sessionFromEvent(f, e, settings.defaultTableSize, bankroll.currency === f.currency ? bankroll.id : undefined);
    saveSession(s);
    updatePlan(f.id, (p) => ({ ...p, picked: p.picked.includes(e.id) ? p.picked : [...p.picked, e.id], sessions: { ...p.sessions, [e.id]: s.id } }));
    // Already in: its "registo fecha" reminder goes.
    void syncFestivalReminders(f, getPlan(f.id), kindOn(settings, 'festival'));
    router.push('/session');
  };
}
