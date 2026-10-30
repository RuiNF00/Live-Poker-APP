import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import React, { createContext, useContext, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { featuresFor, PAYWALL_COPY, type PaywallReason, type ProFeature } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { CompareSheet } from '@/components/CompareTable';
import { Button, Card, Empty, Row, Screen, T, type IconName } from '@/components/ui';
import { useStore } from '@/store/store';
import { t } from '@/i18n';
import { C, R, S, ff } from '@/theme';

const ICON = { staking: 'people', swaps: 'swap-horizontal', taxReport: 'document-text', homeTotal: 'globe', insights: 'bulb', downswingRead: 'trending-down', winrateDetail: 'speedometer', monthCompare: 'calendar', moveUpPlan: 'layers', villainRange: 'grid', faceVideo: 'videocam', voiceHand: 'mic' } as const satisfies Record<ProFeature, string>;

/** True when this feature needs a paid plan the player doesn't have (Plus is enough for what PLUS_UNLOCKS lists). */
export function useLocked(feature: ProFeature): boolean {
  return !usePro().can(feature);
}

/**
 * «3 dias grátis no plano anual» under a lock, when the store still offers this player the trial.
 * Only once something is saved (the trial comes after the first hand or session) and never at the
 * table: nothing about the trial mid-session.
 */
export function useTrialLine(): string | null {
  const { isPro, trialDays } = usePro();
  const { hands, sessions, activeSession } = useStore();
  if (isPro || trialDays < 1 || activeSession) return null;
  if (!hands.length && !sessions.some((s) => s.endedAt)) return null;
  return t('{days} dias grátis no plano anual. Cancelas quando quiseres nas Definições.', { days: trialDays });
}

/** What a locked screen shows: what the feature does, what else Pro has, and the one Pro paywall. */
export function ProLocked({ feature, title }: { feature: ProFeature; title: string }) {
  const { paywall } = usePro();
  const copy = PAYWALL_COPY[feature];
  const trial = useTrialLine();
  const [comparing, setComparing] = useState(false);
  // The feature itself is the title: the rows say what else comes with it.
  const more = featuresFor(feature)
    .map((x) => x.feature)
    .filter((x) => x.key !== feature)
    .slice(0, 2);
  return (
    <>
      <Stack.Screen options={{ title, headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.xl }}>
        <Empty
          icon={ICON[feature]}
          title={copy.title}
          body={copy.body}
          action={
            <View style={{ gap: S.md }}>
              {more.length ? (
                <View style={{ gap: S.sm, paddingHorizontal: S.sm }}>
                  <T v="label">{t('Com Pro, também')}</T>
                  {more.map((f) => (
                    <Row key={f.key} gap={S.sm}>
                      <Ionicons name={f.icon as IconName} size={16} color={C.textDim} />
                      <T v="small" color={C.text} style={{ flex: 1 }}>
                        {f.title}
                        <T v="small">{' · ' + f.body}</T>
                      </T>
                    </Row>
                  ))}
                </View>
              ) : null}
              <Button title={t('Ver com Pro')} iconRight="chevron-forward" onPress={() => paywall(feature)} />
              {trial ? (
                <T v="small" style={{ textAlign: 'center' }}>
                  {trial}
                </T>
              ) : null}
              <Pressable accessibilityRole="button" onPress={() => setComparing(true)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <T v="small" color={C.accent} style={{ fontFamily: ff(700) }}>
                  {t('Comparar Grátis e Pro')}
                </T>
              </Pressable>
            </View>
          }
        />
        <CompareSheet
          visible={comparing}
          onClose={() => setComparing(false)}
          onPro={() => {
            setComparing(false);
            paywall(feature);
          }}
        />
      </Screen>
    </>
  );
}

/** True inside a withPro screen kept open for the player's own data after Pro ended. */
const ReadOnly = createContext(false);

/**
 * In a screen kept after Pro ended: `readOnly`, and `gate`, which sends a change through
 * "Ver com Pro" (and makes it once Pro is back) instead of making it.
 */
export function useProReadOnly(feature: ProFeature) {
  const readOnly = useContext(ReadOnly);
  const { paywall } = usePro();
  const gate =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A) =>
      readOnly ? paywall(feature, () => fn(...a)) : fn(...a);
  return { readOnly, gate };
}

/**
 * A screen that needs Pro. The screen itself mounts only when unlocked, so its hooks never run behind the gate.
 * With `keep`, a player who made something here while Pro (backers, packages) still sees it after Pro ends,
 * read-only: nothing they made disappears.
 */
export function withPro<P extends object>(feature: ProFeature, title: string, Inner: React.ComponentType<P>, keep?: () => boolean) {
  function Gated(props: P) {
    const locked = useLocked(feature);
    const has = keep?.() ?? false;
    if (!locked) return <Inner {...props} />;
    if (has)
      return (
        <ReadOnly.Provider value>
          <Inner {...props} />
        </ReadOnly.Provider>
      );
    return <ProLocked feature={feature} title={title} />;
  }
  Gated.displayName = `withPro(${feature})`;
  return Gated;
}

/** The line at the top of a kept screen: everything is here to see; changing it is with Pro. */
export function ReadOnlyNote({ feature, body }: { feature: Exclude<PaywallReason, 'generic'>; body: string }) {
  return <ProRow feature={feature} title={t('Só para ver')} body={body} />;
}

/**
 * A Pro card inside a free screen: the card itself, blurred and hidden from
 * screen readers, with what it would tell you and the one button to the
 * paywall for this feature. Every locked card looks like this.
 */
export function ProBlur({ feature, title, locked, children }: { feature: Exclude<PaywallReason, 'generic'>; title: string; locked: boolean; children: React.ReactNode }) {
  const { paywall } = usePro();
  const trial = useTrialLine();
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
        {trial ? (
          <T v="tiny" color={C.text} style={{ textAlign: 'center' }}>
            {trial}
          </T>
        ) : null}
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
