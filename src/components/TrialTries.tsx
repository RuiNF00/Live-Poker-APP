import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { currentTrial } from '@/billing/nudges-sync';
import { ONBOARDING_KEY, type Answers } from '@/billing/onboarding';
import { usePro } from '@/billing/pro';
import { forTrial, showTries, TRIES, triesFor, type TriesState, type TryKey } from '@/billing/trial-tries';
import { Card, Row, T, tap, type IconName } from '@/components/ui';
import { locale, t } from '@/i18n';
import { track } from '@/lib/events';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

const KEY = 'rl.trial.tries.v1';
const HIDDEN = 'rl.trial.tries.hidden.v1';

/** The three things for this player in this trial, and which they've opened. Shared by the home card and the "trial off" screen. */
export function useTrialTries() {
  const { isPro } = usePro();
  const { sessions, backers } = useStore();
  const [trial, setTrial] = useState<{ start: number; end: number } | null>(null);
  const [state, setState] = useState<TriesState | null>(null);
  const [hiddenFor, setHiddenFor] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [now, setNow] = useState(0);

  // Read again on every visit: the trial can be turned off in the store, and a try is marked on the way out.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([currentTrial(), AsyncStorage.multiGet([KEY, HIDDEN, ONBOARDING_KEY])])
        .then(([tr, [[, s], [, h], [, o]]]) => {
          if (!live) return;
          setNow(Date.now());
          setTrial(tr);
          setState(tr ? forTrial(s ? (JSON.parse(s) as TriesState) : null, tr.start) : null);
          setHiddenFor(h ? Number(h) : null);
          setAnswers(o ? (JSON.parse(o) as Answers) : null);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );

  const done = sessions.filter((s) => s.endedAt);
  const keys = triesFor(answers, {
    sessions: done.length,
    mtt: done.filter((s) => s.kind === 'mtt').length,
    currencies: new Set(done.map((s) => s.currency)).size,
    backers: backers.length,
  });
  if (!isPro || !trial || !state) return null;

  const open = (k: TryKey) => {
    tap();
    const next = state.done.includes(k) ? state : { ...state, done: [...state.done, k] };
    setState(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    track('onboarding_step', { step: 'trial_try', try: k });
    router.push(TRIES[k].route as never);
  };
  const hide = () => {
    setHiddenFor(trial.start);
    AsyncStorage.setItem(HIDDEN, String(trial.start)).catch(() => {});
  };
  const show = showTries(trial, state, keys, hiddenFor, now);
  const until = new Date(trial.end).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return { keys, done: state.done, open, hide, show, until };
}

/** One row per thing to try; a tick once it was opened. */
export function TryRows({ state }: { state: NonNullable<ReturnType<typeof useTrialTries>> }) {
  const { keys, done, open } = state;
  return (
    <View style={{ gap: 2 }}>
      {keys.map((k) => {
        const it = TRIES[k];
        const ok = done.includes(k);
        return (
          <Pressable
            key={k}
            onPress={() => open(k)}
            accessibilityRole="button"
            accessibilityLabel={`${t(it.title)}. ${t(it.body)}${ok ? '. ' + t('Já viste') : ''}`}
            style={({ pressed }) => ({
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              gap: S.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: ok ? C.surface2 : C.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={(ok ? 'checkmark' : it.icon) as IconName} size={16} color={ok ? C.good : C.accent} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <T v="body" color={ok ? C.textDim : C.text}>
                {t(it.title)}
              </T>
              <T v="tiny">{t(it.body)}</T>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Home card while the free trial runs: three Pro things picked for the player, so the days
 * go on what Pro does for them. Goes once all three were opened, the trial ends, or it's hidden.
 */
export function TrialTries({ state }: { state: NonNullable<ReturnType<typeof useTrialTries>> }) {
  const { keys, done, hide, until } = state;
  const n = keys.filter((k) => done.includes(k)).length;
  return (
    <Card style={{ gap: S.sm, paddingVertical: 12 }}>
      <Row gap={S.sm}>
        <View style={{ flex: 1, gap: 1 }}>
          <T v="h3">{t('Experimenta enquanto tens Pro')}</T>
          <T v="tiny">{t('O teste grátis vai até {date}', { date: until })}</T>
        </View>
        <T v="monoS" color={C.accent}>
          {n}/{keys.length}
        </T>
        <Pressable onPress={hide} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Esconder')}>
          <Ionicons name="close" size={18} color={C.muted} />
        </Pressable>
      </Row>
      <TryRows state={state} />
    </Card>
  );
}
