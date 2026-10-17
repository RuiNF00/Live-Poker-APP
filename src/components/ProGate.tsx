import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PAYWALL_COPY, PRO_ONLY, type PaywallReason, type ProFeature } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { Button, Card, Empty, Screen, T } from '@/components/ui';
import { t } from '@/i18n';
import { C, R, S } from '@/theme';

const ICON = { staking: 'people', swaps: 'swap-horizontal', taxReport: 'document-text', homeTotal: 'globe', insights: 'bulb', downswingRead: 'trending-down', winrateDetail: 'speedometer', monthCompare: 'calendar', moveUpPlan: 'layers', villainRange: 'grid' } as const satisfies Record<ProFeature, string>;

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

/**
 * A Pro card inside a free screen: the card itself, blurred and hidden from
 * screen readers, with what it would tell you and the one button to the
 * paywall for this feature. Every locked card looks like this.
 */
export function ProBlur({ feature, title, locked, children }: { feature: Exclude<PaywallReason, 'generic'>; title: string; locked: boolean; children: React.ReactNode }) {
  const { paywall } = usePro();
  if (!locked) return <>{children}</>;
  return (
    <View style={{ borderRadius: R.lg, overflow: 'hidden', minHeight: 140 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {children}
      </View>
      <BlurView intensity={28} tint="dark" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: S.lg, gap: S.sm }]}>
        <T v="h3" style={{ textAlign: 'center' }}>
          {title}
        </T>
        <Button size="md" icon="lock-closed" title={t('Ver com Pro')} onPress={() => paywall(feature)} />
      </BlurView>
    </View>
  );
}

/** The same lock as a row, where the Pro part is a list of amounts (settling up): what it gives, and the paywall for this feature. */
export function ProRow({ feature, title, body }: { feature: Exclude<PaywallReason, 'generic'>; title: string; body: string }) {
  const { paywall } = usePro();
  return (
    <Card onPress={() => paywall(feature)} accessibilityLabel={title} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <Ionicons name="lock-closed" size={20} color={C.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3">{title}</T>
        <T v="small">{body}</T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </Card>
  );
}
