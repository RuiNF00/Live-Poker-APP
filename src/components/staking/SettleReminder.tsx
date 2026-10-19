// "Acerto com {backer}": a local notification at 13:00 the day after an event of a
// sold-action package that has no session, so the player answers "Não jogaste o …?"
// and the accounts can close (spec: design/notificacoes.md, row 12). Only when
// notifications are already allowed; no amounts, so nothing private on the lock
// screen. Held while a session is being played: it is scheduled again when it ends.
// Off with Settings › Notificações › Swaps e staking; never in the quiet hours.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { t } from '@/i18n';
import { notifications, setup } from '@/lib/lock-screen/reminder';
import { notifyAt, notifyKindOn } from '@/lib/notify-gate';
import { getOffers, settleReminders, useOffers } from '@/store/action-offer';
import { festivalName, getPlan } from '@/store/festival-plan';
import { shippedFestivals } from '@/store/my-festivals';
import { isPaused } from '@/store/session-math';
import { useStore } from '@/store/store';

const PREFIX = 'sweatbook-settle-';
const CHANNEL = 'money';
/** When each reminder was scheduled (`offerId:eventId`), so one gone by is never repeated. */
const SENT_KEY = 'rl.settleReminders.v1';

async function sync(names: Map<string, string>, playing: boolean) {
  const n = notifications();
  if (!n) return;
  try {
    if (!(await n.getPermissionsAsync()).granted) return;
    await setup(n);
    if (Platform.OS === 'android')
      await n.setNotificationChannelAsync(CHANNEL, { name: t('Swaps e staking'), importance: n.AndroidImportance.DEFAULT, lockscreenVisibility: n.AndroidNotificationVisibility.PRIVATE });
    for (const r of await n.getAllScheduledNotificationsAsync()) if (r.identifier.startsWith(PREFIX)) await n.cancelScheduledNotificationAsync(r.identifier);
    // Nothing during a session: it comes back when the session ends or pauses.
    if (playing || !notifyKindOn('money')) return;
    const sent: Record<string, number> = JSON.parse((await AsyncStorage.getItem(SENT_KEY)) ?? '{}');
    const items = getOffers().flatMap((o) => {
      const f = shippedFestivals().find((x) => x.id === o.festivalId);
      return f ? [{ f, o, started: getPlan(f.id).sessions }] : [];
    });
    for (const r of settleReminders(items, Date.now(), sent).map((x) => ({ ...x, at: notifyAt('money', x.at) }))) {
      const it = items.find((x) => x.o.id === r.offerId)!;
      const backers = it.o.lines.map((l) => names.get(l.backerId)).filter(Boolean);
      await n.scheduleNotificationAsync({
        identifier: PREFIX + r.offerId,
        content: {
          title: backers.length === 1 ? t('Acerto com {name}', { name: backers[0]! }) : t('Acerto: {title}', { title: festivalName(it.f, getPlan(it.f.id)) }),
          body: t('O torneio acabou. Regista o resultado para fechar as contas.'),
          data: { url: `sweatbook://action/${r.offerId}` },
          sound: true,
        },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
      });
      sent[`${r.offerId}:${r.eventId}`] = r.at;
    }
    await AsyncStorage.setItem(SENT_KEY, JSON.stringify(sent));
  } catch (e) {
    console.warn('[staking] settle reminder', e);
  }
}

/** Keeps the settlement reminders in step with the packages, the sessions and the answers. */
export function SettleReminder() {
  const offers = useOffers();
  const { sessions, backers, settings } = useStore();
  const on = settings.notify?.money !== false;
  const key = backers.map((b) => `${b.id}:${b.name}`).join('|');
  const playing = sessions.some((s) => !s.endedAt && !isPaused(s));
  useEffect(() => {
    const names = new Map(backers.map((b) => [b.id, b.name]));
    void sync(names, playing);
    // Back from the background: a session may have been started from the festival meanwhile.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void sync(names, playing);
    });
    return () => sub.remove();
    // Re-sync when packages, sessions (and so the plan's links), backer names, playing or the switch change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, sessions, key, playing, on]);
  return null;
}
