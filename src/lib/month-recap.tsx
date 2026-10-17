// The recap on the 1st: one local notification at 13:00 for the month just
// finished, rescheduled whenever sessions or privacy mode change so its text
// matches what the app would show. And "O teu ano no póquer" on 31 December
// at 18:00, held by a live session. Never asks for permission by itself; the
// month screen offers that.

import { useEffect } from 'react';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import { monthRecap, nextRecap, recapNotice } from '@/store/month-recap';
import { planYearRecap, yearNotice, yearSessions } from '@/store/year-recap';
import { useStore } from '@/store/store';
import type { Session, Settings } from '@/store/types';

import { notifications, setup } from './lock-screen/reminder';
import { notifyAt, notifyOrHold } from './notify-gate';
import { kindOn } from './notify-policy';

const ID = 'sweatbook-month-recap';
const YEAR_ID = 'sweatbook-year-recap';
const CHANNEL = 'recap';

/** The notice carries results only with "show amounts in notifications" on and privacy mode off. */
export const recapHidden = (s: Settings) => !s.notifyAmounts || !!s.hideAmounts;

export async function syncMonthRecap(sessions: Session[], settings: Settings, now = Date.now()): Promise<void> {
  const n = notifications();
  if (!n) return;
  try {
    await setup(n);
    if (Platform.OS === 'android') await n.setNotificationChannelAsync(CHANNEL, { name: t('Resumo do mês'), importance: n.AndroidImportance.DEFAULT });
    await n.cancelScheduledNotificationAsync(ID);
    if (!kindOn(settings, 'recap')) return;
    const { at: planned, key } = nextRecap(now);
    const at = notifyAt('recap', planned);
    const r = monthRecap(sessions, key);
    if (!r.sessions) return;
    if (!(await n.getPermissionsAsync()).granted) return;
    const { title, body } = recapNotice(r, recapHidden(settings));
    await n.scheduleNotificationAsync({
      identifier: ID,
      content: { title, body, data: { url: `sweatbook://month?m=${key}` } },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  } catch (e) {
    console.warn('[month-recap]', e);
  }
}

/**
 * The year notice. A scheduled one whose time has passed counts as sent; a
 * held one is cancelled and goes out at the next sync without a live session.
 */
export async function syncYearRecap(sessions: Session[], settings: Settings, setSettings: (p: Partial<Settings>) => void, now = Date.now()): Promise<void> {
  const n = notifications();
  if (!n) return;
  try {
    await setup(n);
    if (Platform.OS === 'android') await n.setNotificationChannelAsync(CHANNEL, { name: t('Resumo do mês'), importance: n.AndroidImportance.DEFAULT });
    await n.cancelScheduledNotificationAsync(YEAR_ID);
    const fired = settings.yearRecapAt && now >= settings.yearRecapAt ? new Date(settings.yearRecapAt).getFullYear() : undefined;
    if (fired !== undefined && fired !== settings.yearRecapSent) setSettings({ yearRecapSent: fired, yearRecapAt: undefined });
    const plan = !kindOn(settings, 'recap') ? null : planYearRecap(now, fired ?? settings.yearRecapSent, sessions.some((s) => !s.endedAt));
    const list = plan && plan.kind !== 'none' ? yearSessions(sessions, plan.year) : null;
    if (!plan || plan.kind === 'none' || !list || !(await n.getPermissionsAsync()).granted) {
      if (settings.yearRecapAt && fired === undefined) setSettings({ yearRecapAt: undefined });
      return;
    }
    const { title, body } = yearNotice(list, plan.year, recapHidden(settings));
    const content = { title, body, data: { url: `sweatbook://year?y=${plan.year}` } };
    if (plan.kind === 'now') {
      // Late (held by a session, or the phone was off): through the shared gate, which holds it again if a session is live.
      notifyOrHold('recap', () => {
        void n.scheduleNotificationAsync({ identifier: YEAR_ID, content, trigger: null });
        setSettings({ yearRecapSent: plan.year, yearRecapAt: undefined });
      });
      return;
    }
    const at = notifyAt('recap', plan.at);
    await n.scheduleNotificationAsync({ identifier: YEAR_ID, content, trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL } });
    if (settings.yearRecapAt !== at) setSettings({ yearRecapAt: at });
  } catch (e) {
    console.warn('[year-recap]', e);
  }
}

/** Mounted once at the root: keeps the notification in step with the data. */
export function MonthRecapSync() {
  const { sessions, settings, setSettings, ready } = useStore();
  const { hideAmounts, monthRecap: on, notifyAmounts } = settings;
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      void syncMonthRecap(sessions, settings);
      void syncYearRecap(sessions, settings, setSettings);
    }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the fields the notice reads
  }, [ready, sessions, hideAmounts, on, notifyAmounts]);
  return null;
}
