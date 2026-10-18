// The charge notice inside the app, for players who didn't allow notifications:
// the paywall's timeline promises "Avisamos-te antes de cobrar", and this keeps
// that promise without a notification (payments audit §9). Same window and text
// as the notification (nudges.ts).

import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { chargeNoticeDue } from '@/billing/nudges';
import { currentTrial } from '@/billing/nudges-sync';
import { manageSubscription } from '@/billing/purchases';
import { usePro } from '@/billing/pro';
import { Banner } from '@/components/ui';
import { locale, t } from '@/i18n';
import { notifications } from '@/lib/lock-screen/reminder';

/** The trial's end, when the in-app notice should show on the home screen. */
export function useChargeNotice(): number | null {
  const { isPro } = usePro();
  const [end, setEnd] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!isPro) return;
      let live = true;
      (async () => {
        const trial = await currentTrial();
        const n = notifications();
        const on = n ? (await n.getPermissionsAsync().catch(() => ({ granted: false }))).granted : false;
        if (live) setEnd(trial && chargeNoticeDue(trial, Date.now(), on) ? trial.end : null);
      })().catch(() => {});
      return () => {
        live = false;
      };
    }, [isPro]),
  );
  return isPro ? end : null;
}

export function ChargeNotice({ end }: { end: number }) {
  const { plans } = usePro();
  const price = plans.find((p) => p.id === 'annual')?.priceString ?? '';
  const date = new Date(end).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const android = Platform.OS === 'android';
  const store = android ? 'Google Play' : 'App Store';
  return (
    <Banner
      tone="info"
      icon="card-outline"
      title={t('O teste grátis acaba a {date}', { date })}
      body={
        // Prices not loaded (offline): no empty "Depois,  por ano", and never a made-up price.
        !price
          ? t('Depois, passa à subscrição anual. Para não pagar, cancela na {store} até 24 h antes.', { store })
          : android
            ? t('Depois, {price} por ano. Para não pagar, cancela na Google Play antes dessa data.', { price })
            : t('Depois, {price} por ano. Para não pagar, cancela na {store} até 24 h antes.', { price, store })
      }
      action={t('Gerir')}
      onPress={() => void manageSubscription()}
    />
  );
}
