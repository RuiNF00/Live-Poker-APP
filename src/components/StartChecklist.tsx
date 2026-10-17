import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { START_STEPS, startProgress, type StartStep } from '@/billing/onboarding';
import { Card, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

const HIDDEN = 'rl.start.hidden.v1';
const FORTNIGHT = 14 * 86_400_000;

/**
 * First-week checklist on the hands list (Mural pattern): four things that
 * make the app stick, each one tap away. Goes once all four are done, or
 * when the player hides it. The hook says whether it shows, so the home
 * keeps a single context card at a time.
 */
export function useStartChecklist() {
  const { hands, sessions, transfers } = useStore();
  const [hidden, setHidden] = useState(true);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    AsyncStorage.getItem(HIDDEN)
      .then((v) => setHidden(v === '1'))
      .catch(() => setHidden(false));
  }, []);
  const done = startProgress({ hands, sessions: sessions.length, deposits: transfers.filter((x) => x.kind === 'deposit').length });
  const count = START_STEPS.filter((s) => done[s.key]).length;
  // First week means it: players whose first hand is older than two weeks don't need it.
  const first = hands.length ? Math.min(...hands.map((h) => h.createdAt)) : 0;
  if (hidden || hands.length === 0 || count === START_STEPS.length || now - first > FORTNIGHT) return null;
  const next = START_STEPS.find((s) => !done[s.key])!;

  const go = (k: StartStep) => {
    tap();
    if (k === 'hand') router.push('/hand/new');
    else if (k === 'session') router.push('/session');
    else if (k === 'bankroll') router.push('/bankroll');
    else {
      const last = [...hands].sort((a, b) => b.createdAt - a.createdAt)[0];
      router.push({ pathname: '/hand/[id]', params: { id: last.id } });
    }
  };
  const hide = () => {
    setHidden(true);
    AsyncStorage.setItem(HIDDEN, '1').catch(() => {});
  };
  return { count, next, go, hide, handsCount: hands.length };
}

/** Progress and the next step only: the full list would push the hands off screen. */
export function StartChecklist({ state }: { state: NonNullable<ReturnType<typeof useStartChecklist>> }) {
  const { count, next, go, hide, handsCount } = state;
  return (
    <Card style={{ gap: S.sm, paddingVertical: 12 }}>
      <Row gap={S.sm}>
        <T v="h3" style={{ flex: 1 }}>
          {t('Primeira semana')}
        </T>
        <T v="monoS" color={C.accent}>
          {count}/{START_STEPS.length}
        </T>
        <Pressable onPress={hide} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Esconder')}>
          <Ionicons name="close" size={18} color={C.muted} />
        </Pressable>
      </Row>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: C.surface3, overflow: 'hidden' }}>
        <View style={{ width: `${(count / START_STEPS.length) * 100}%`, height: 4, backgroundColor: C.accent }} />
      </View>
      <Pressable onPress={() => go(next.key)} accessibilityRole="button" accessibilityLabel={t('Próximo: {step}', { step: t(next.label) })} style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <Ionicons name="ellipse-outline" size={20} color={C.muted} />
        <T v="body" style={{ flex: 1 }} numberOfLines={1}>
          {t(next.label)}
        </T>
        {next.key === 'hand' ? (
          <T v="monoS" color={C.textDim}>
            {handsCount}/3
          </T>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={C.muted} />
      </Pressable>
    </Card>
  );
}
