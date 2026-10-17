import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GOALS, ONBOARDING_KEY, planFor, PLAYS, VOLUMES, type Answers, type Goal } from '@/billing/onboarding';
import { usePro } from '@/billing/pro';
import { Replayer } from '@/components/Replayer';
import { Button, Row, T, tap, type IconName } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { claimState } from '@/lib/referrals';
import { sampleHand } from '@/poker/sample';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

const CURRENCIES = ['€', '$', '£', 'R$', 'CHF'];
const STEPS = ['hero', 'goals', 'plays', 'volume', 'currency', 'plan'] as const;

/**
 * First run: a sample hand replaying (the "aha" before anything else), four
 * one-tap questions, a plan built from them, then the paywall as the last step.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { settings, setSettings, bankrolls, sessions, transfers, saveBankroll } = useStore();
  const { isPro, paywall } = usePro();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ goals: [], plays: null, volume: null });
  const sample = useMemo(() => sampleHand('sample'), []);
  const plan = planFor(a);
  const at = STEPS[step];
  const [skipped, setSkipped] = useState(false);
  // One event per screen reached, so the funnel shows where people stop.
  useEffect(() => track('onboarding_step', { step: at, index: step }), [at, step]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const finish = () => {
    AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(a)).catch(() => {});
    track('onboarding_step', { step: 'done', index: STEPS.length, skipped, goals: a.goals.join(','), plays: a.plays ?? '', volume: a.volume ?? '' });
    router.back();
    // After the modal is gone, so the paywall slides up over the home screen.
    // Pro already, or invited (their Pro days come with the first hand): no paywall to end on.
    claimState()
      .catch(() => null)
      .then((claim) => {
        const invited = !!claim && (claim.result === 'ok' || claim.result === 'already');
        if (!isPro && !invited) setTimeout(() => paywall('plan'), 350);
      });
  };
  const toggle = (g: Goal) => setA((x) => ({ ...x, goals: x.goals.includes(g) ? x.goals.filter((y) => y !== g) : [...x.goals, g] }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.sm, paddingBottom: insets.bottom + S.sm }}>
      {step > 0 ? (
        <Row style={{ paddingHorizontal: S.gutter, minHeight: 44 }} gap={S.md}>
          <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Voltar')}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {STEPS.slice(1).map((s, i) => (
              <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? C.accent : C.surface3 }} />
            ))}
          </View>
          {at !== 'plan' ? (
            <Pressable
              onPress={() => {
                setSkipped(true);
                setStep(STEPS.length - 1);
              }}
              hitSlop={10}
              accessibilityRole="button">
              <T v="small" color={C.textDim}>
                {t('Saltar')}
              </T>
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </Row>
      ) : null}

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: S.gutter, gap: S.xl }}>
        {at === 'hero' ? (
          <>
            <View style={{ marginHorizontal: -S.gutter }}>
              <Replayer hand={sample} autoPlay />
            </View>
            <View style={{ gap: S.sm }}>
              <T v="title">{t('A tua mão, revista em 30 segundos')}</T>
              <T v="callout">{t('Regista entre mãos. Revê rua a rua.')}</T>
            </View>
          </>
        ) : null}

        {at === 'goals' ? (
          <Question title={t('O que queres da Sweatbook?')} hint={t('Escolhe uma ou mais.')}>
            {GOALS.map((g) => (
              <Option key={g.key} icon={g.icon as IconName} label={t(g.label)} active={a.goals.includes(g.key)} multi onPress={() => toggle(g.key)} />
            ))}
          </Question>
        ) : null}

        {at === 'plays' ? (
          <Question title={t('O que jogas mais?')}>
            {PLAYS.map((p) => (
              <Option
                key={p.key}
                label={t(p.label)}
                sub={t(p.sub)}
                active={a.plays === p.key}
                onPress={() => {
                  setA((x) => ({ ...x, plays: p.key }));
                  next();
                }}
              />
            ))}
          </Question>
        ) : null}

        {at === 'volume' ? (
          <Question title={t('Quantas sessões jogas?')}>
            {VOLUMES.map((v) => (
              <Option
                key={v.key}
                label={t(v.label)}
                active={a.volume === v.key}
                onPress={() => {
                  setA((x) => ({ ...x, volume: v.key }));
                  next();
                }}
              />
            ))}
          </Question>
        ) : null}

        {at === 'currency' ? (
          <Question title={t('Em que moeda jogas?')}>
            {CURRENCIES.map((c) => (
              <Option
                key={c}
                label={c}
                active={settings.currency === c}
                onPress={() => {
                  setSettings({ currency: c });
                  // The bankroll made on first launch is still empty: give it the same currency.
                  const b = bankrolls[0];
                  if (bankrolls.length === 1 && b.currency !== c && !sessions.length && !transfers.length) saveBankroll({ ...b, currency: c });
                  next();
                }}
              />
            ))}
          </Question>
        ) : null}

        {at === 'plan' ? (
          <View style={{ gap: S.xl }}>
            <View style={{ gap: S.sm }}>
              <T v="label" color={C.accent}>
                {t('O teu plano está pronto')}
              </T>
              <T v="title">{t(plan.title)}</T>
            </View>
            <View style={{ gap: S.md }}>
              {plan.points.map((p) => (
                <Row key={p} gap={S.md}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={16} color={C.accent} />
                  </View>
                  <T v="body" style={{ flex: 1 }}>
                    {t(p)}
                  </T>
                </Row>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm }}>
        {at === 'hero' ? <Button title={t('Começar')} iconRight="chevron-forward" onPress={next} /> : null}
        {at === 'goals' ? <Button title={t('Continuar')} disabled={!a.goals.length} onPress={next} /> : null}
        {at === 'plan' ? <Button title={t('Continuar')} iconRight="chevron-forward" onPress={finish} /> : null}
      </View>
    </View>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: S.lg }}>
      <View style={{ gap: S.xs }}>
        <T v="title">{title}</T>
        {hint ? <T v="callout">{hint}</T> : null}
      </View>
      <View style={{ gap: S.sm }}>{children}</View>
    </View>
  );
}

function Option({ label, sub, icon, active, multi, onPress }: { label: string; sub?: string; icon?: IconName; active: boolean; multi?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: active }}
      style={({ pressed }) => ({
        minHeight: 60,
        paddingHorizontal: S.lg,
        paddingVertical: S.md,
        borderRadius: R.lg,
        borderWidth: 1.5,
        borderColor: active ? C.accent : C.border,
        backgroundColor: active ? C.accentSoft : C.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.md,
        opacity: pressed ? 0.85 : 1,
      })}>
      {icon ? <Ionicons name={icon} size={20} color={active ? C.accent : C.textDim} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3">{label}</T>
        {sub ? <T v="small">{sub}</T> : null}
      </View>
      {multi ? <Ionicons name={active ? 'checkbox' : 'square-outline'} size={22} color={active ? C.accent : C.muted} /> : null}
    </Pressable>
  );
}
