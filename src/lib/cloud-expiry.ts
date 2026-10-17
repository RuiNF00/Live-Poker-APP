// The server deletes a cloud copy that hasn't been updated for 18 months
// (purge-old-app-backups). Opening the app updates it within hours, so only a
// player who stopped opening it loses it: one local notification a month
// before, moved again after every copy. Under "Lembretes", out of quiet hours.

import { t } from '@/i18n';

import type { CloudState } from './cloud-code';
import { expiryWarnAt } from './cloud-guard';
import { notifications, setup } from './lock-screen/reminder';
import { notifyAt, notifyKindOn } from './notify-gate';
import { kindInfo } from './notify-policy';

const ID = 'cloud-expiry';

export async function syncCloudExpiry(c: CloudState | null): Promise<void> {
  const n = notifications();
  if (!n) return;
  try {
    await setup(n);
    await n.cancelScheduledNotificationAsync(ID);
    const at = expiryWarnAt(c);
    if (at === null || !notifyKindOn('tips') || !(await n.getPermissionsAsync()).granted) return;
    await n.scheduleNotificationAsync({
      identifier: ID,
      content: { title: t('A tua cópia na nuvem vai ser apagada'), body: t('Abre a Sweatbook este mês para a manter. Uma cópia sem uso durante 18 meses é apagada.'), data: { url: 'sweatbook://settings' } },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: notifyAt('tips', at), channelId: kindInfo('tips').channel },
    });
  } catch (e) {
    console.warn('[cloud] expiry notice', e);
  }
}
