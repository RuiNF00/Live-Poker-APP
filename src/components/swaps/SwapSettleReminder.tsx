// "O swap de Lisboa está fechado: falta acertar": once every result of a one-event swap is in
// and I still pay or get paid, one local notification a couple of hours later, and the home
// card (SwapSettleCard) until it's settled. No amounts on the lock screen, never in the quiet
// hours, held while a session is played (design/notificacoes.md). The payer's tap opens the
// payment, one tap from "Paguei"; recording a payment is free, so a Pro lock changes nothing.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { Banner } from '@/components/ui';
import { t } from '@/i18n';
import { notifications, setup } from '@/lib/lock-screen/reminder';
import { notifyAt, notifyKindOn } from '@/lib/notify-gate';
import { isPaused } from '@/store/session-math';
import { useStore } from '@/store/store';
import { swapsToSettle, type ToSettle } from '@/store/swaps';
import { useGroups } from '@/store/swap-groups-store';
import { useSwaps } from '@/store/swaps-store';

const PREFIX = 'sweatbook-swapsettle-';
const CHANNEL = 'money';
/** When each reminder was scheduled (swap id → ms), so one that went off is never repeated. */
const SENT_KEY = 'rl.swapSettle.v1';
/** Swaps whose home card was put away. */
const HIDDEN_KEY = 'rl.swapSettleHidden.v1';
/** Time to settle at the table before the reminder. */
const AFTER = 2 * 3600000;

/** Where a tap lands: the payment for the payer, the accounts for the other side. */
export function settleUrl(x: ToSettle): string {
  return `sweatbook://swap/${x.group ? 'g/' : ''}${x.id}${x.pay ? '?pay=1' : ''}`;
}

export const settleTitle = (x: ToSettle) => t('O swap de {place} está fechado: falta acertar', { place: x.place });

async function sync(list: ToSettle[], playing: boolean) {
  const n = notifications();
  if (!n) return;
  try {
    if (!(await n.getPermissionsAsync()).granted) return;
    await setup(n);
    if (Platform.OS === 'android')
      await n.setNotificationChannelAsync(CHANNEL, { name: t('Swaps e staking'), importance: n.AndroidImportance.DEFAULT, lockscreenVisibility: n.AndroidNotificationVisibility.PRIVATE });
    for (const r of await n.getAllScheduledNotificationsAsync()) if (r.identifier.startsWith(PREFIX)) await n.cancelScheduledNotificationAsync(r.identifier);
    const now = Date.now();
    const sent: Record<string, number> = JSON.parse((await AsyncStorage.getItem(SENT_KEY)) ?? '{}');
    if (playing || !notifyKindOn('money')) {
      // Not gone off yet: scheduled again when the session ends or the switch comes back.
      for (const [id, at] of Object.entries(sent)) if (at > now) delete sent[id];
    } else {
      for (const x of list) {
        if (sent[x.id] && sent[x.id] <= now) continue;
        const at = sent[x.id] ?? notifyAt('money', Math.max(x.closedAt + AFTER, now + 60000));
        await n.scheduleNotificationAsync({
          identifier: PREFIX + x.id,
          content: {
            title: x.group ? t('Swap de grupo · {title}', { title: x.name }) : t('Swap com {name}', { name: x.name }),
            body: settleTitle(x) + '.',
            data: { url: settleUrl(x) },
            sound: true,
          },
          trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        });
        sent[x.id] = at;
      }
    }
    // Forget the ones settled or gone, so the list stays small.
    const open = new Set(list.map((x) => x.id));
    for (const id of Object.keys(sent)) if (!open.has(id) && sent[id] <= now) delete sent[id];
    await AsyncStorage.setItem(SENT_KEY, JSON.stringify(sent));
  } catch (e) {
    console.warn('[swaps] settle reminder', e);
  }
}

/** The swaps waiting to be settled, from both stores. */
export function useSwapsToSettle(): ToSettle[] {
  const { swaps } = useSwaps();
  const { groups } = useGroups();
  return useMemo(() => swapsToSettle(swaps, groups), [swaps, groups]);
}

/** Mounted once at the root: keeps the reminders in step with the swaps and the session. */
export function SwapSettleReminder() {
  const list = useSwapsToSettle();
  const { sessions, settings } = useStore();
  const on = settings.notify?.money !== false;
  const playing = sessions.some((s) => !s.endedAt && !isPaused(s));
  const key = list.map((x) => `${x.id}:${x.closedAt}:${x.pay}`).join('|');
  useEffect(() => {
    void sync(list, playing);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void sync(list, playing);
    });
    return () => sub.remove();
    // The list changes identity on every store write; its key only when a swap closes or settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, playing, on]);
  return null;
}

/** The home card for the newest swap to settle; "Agora não" puts that swap's card away. */
export function useSwapSettleCard(): { item: ToSettle; more: number; hide: () => void } | null {
  const list = useSwapsToSettle();
  const [hidden, setHidden] = useState<string[] | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(HIDDEN_KEY)
      .then((v) => setHidden(v ? (JSON.parse(v) as string[]) : []))
      .catch(() => setHidden([]));
  }, []);
  if (!hidden) return null;
  const shown = list.filter((x) => !hidden.includes(x.id));
  if (!shown.length) return null;
  const item = shown[0];
  return {
    item,
    more: shown.length - 1,
    hide: () => {
      const next = [item.id, ...hidden].slice(0, 50);
      setHidden(next);
      AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(next)).catch(() => {});
    },
  };
}

export function SwapSettleCard({ item, more, hide }: { item: ToSettle; more: number; hide: () => void }) {
  return (
    <Banner
      icon="swap-horizontal-outline"
      title={settleTitle(item)}
      body={more > 0 ? t('E mais {n} por acertar', { n: more }) : item.pay ? t('Toca para registar o pagamento') : t('Toca para veres as contas')}
      onPress={() => {
        if (more > 0) router.push('/swaps');
        else router.push({ pathname: item.group ? '/swap/g/[id]' : '/swap/[id]', params: item.pay ? { id: item.id, pay: '1' } : { id: item.id } });
      }}
      onDismiss={hide}
      dismissLabel={t('Agora não')}
    />
  );
}
