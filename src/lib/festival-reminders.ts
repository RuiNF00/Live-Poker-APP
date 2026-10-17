// Local notifications for a festival plan: before each planned start and
// before late registration closes. Rescheduled from scratch whenever the plan
// changes; identifiers are stable so a rerun replaces rather than duplicates.

import { Platform } from 'react-native';

import { t } from '@/i18n';
import type { Festival } from '@/poker/festivals';
import { planReminders, type FestivalPlan } from '@/store/festival-plan';

import { notifications, setup } from './lock-screen/reminder';

const CHANNEL = 'festival';

/** Every planned-tournament reminder, of every festival. */
export async function cancelFestivalReminders(): Promise<void> {
  const n = notifications();
  if (!n) return;
  try {
    const scheduled = await n.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((x) => x.content.data?.url === 'sweatbook://festival').map((x) => n.cancelScheduledNotificationAsync(x.identifier)));
  } catch (e) {
    console.warn('[festival] cancel', e);
  }
}

/** `on`: the "Torneios planeados" switch in Settings; off only clears what was scheduled. */
export async function syncFestivalReminders(f: Festival, plan: FestivalPlan, on = true, now = Date.now()): Promise<void> {
  const n = notifications();
  if (!n) return;
  try {
    await setup(n);
    if (Platform.OS === 'android') {
      await n.setNotificationChannelAsync(CHANNEL, { name: t('Torneios planeados'), importance: n.AndroidImportance.HIGH });
    }
    const prefix = f.id + ':';
    const scheduled = await n.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((x) => x.identifier.startsWith(prefix)).map((x) => n.cancelScheduledNotificationAsync(x.identifier)));
    if (!on || !(await n.getPermissionsAsync()).granted) return;
    // iOS keeps at most 64 pending local notifications; a festival plan stays well under that.
    for (const r of planReminders(f, plan, now).slice(0, 40)) {
      await n.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { url: 'sweatbook://festival' }, sound: true },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
      });
    }
  } catch (e) {
    console.warn('[festival] reminders', e);
  }
}
