import { Stack } from 'expo-router';
import React from 'react';

import { PAYWALL_COPY, PRO_ONLY, type ProFeature } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { Button, Empty, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { S } from '@/theme';

const ICON = { staking: 'people', swaps: 'swap-horizontal', taxReport: 'document-text', homeTotal: 'globe', insights: 'bulb', downswingRead: 'trending-down', winrateDetail: 'speedometer', monthCompare: 'calendar', moveUpPlan: 'layers', villainRange: 'grid' } as const;

/** True when this feature needs Pro and the player doesn't have it. */
export function useLocked(feature: ProFeature): boolean {
  return !usePro().isPro && PRO_ONLY[feature];
}

/** What a locked screen shows: what the feature does, and the one Pro paywall. */
export function ProLocked({ feature, title }: { feature: ProFeature; title: string }) {
  const { paywall } = usePro();
  const copy = PAYWALL_COPY[feature];
  return (
    <>
      <Stack.Screen options={{ title, headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.xl }}>
        <Empty icon={ICON[feature]} title={copy.title} body={copy.body} action={<Button title={t('Ver Pro')} iconRight="chevron-forward" onPress={() => paywall(feature)} />} />
      </Screen>
    </>
  );
}

/** A screen that needs Pro. The screen itself mounts only when unlocked, so its hooks never run behind the gate. */
export function withPro<P extends object>(feature: ProFeature, title: string, Inner: React.ComponentType<P>) {
  function Gated(props: P) {
    return useLocked(feature) ? <ProLocked feature={feature} title={title} /> : <Inner {...props} />;
  }
  Gated.displayName = `withPro(${feature})`;
  return Gated;
}
