import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ONBOARDING_KEY, startProgress, startSteps, type StartStep } from '@/billing/onboarding';
import { Card, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { FESTIVALS } from '@/poker/festivals';
import { useFestivalPlan } from '@/store/festival-plan';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

const HIDDEN = 'rl.start.hidden.v1';
const FORTNIGHT = 14 * 86_400_000;

/**
 * First-week checklist on the hands list (Mural pattern): four things that
 * make the app stick, each one tap away. Goes once all four are done, or
 * when the player hides it.
 */
export function StartChecklist() {
  const { hands, sessions, transfers } = useStore();
  const [hidden, setHidden] = useState(true);
  const [now] = useState(() => Date.now());
  // What they told us on first run: tournament players get a festival step.
  const [plays, setPlays] = useState<string | null>(null);
  const fest = useFestivalPlan(FESTIVALS[0]?.id ?? '');
  useEffect(() => {
    AsyncStorage.multiGet([HIDDEN, ONBOARDING_KEY])
      .then(([[, v], [, o]]) => {
        setHidden(v === '1');
        setPlays((o ? (JSON.parse(o) as { plays?: string }) : {}).plays ?? null);
      })
      .catch(() => setHidden(false));
  }, []);
  const START_STEPS = startSteps(plays);
  const done = startProgress({ hands, sessions: sessions.length, deposits: transfers.filter((x) => x.kind === 'deposit').length, festivalPicks: fest.picked.length });
  const count = START_STEPS.filter((s) => done[s.key]).length;
  // First week means it: players whose first hand is older than two weeks don't need it.
  const first = hands.length ? Math.min(...hands.map((h) => h.createdAt)) : 0;
  if (hidden || hands.length === 0 || count === START_STEPS.length || now - first > FORTNIGHT) return null;

  const go = (k: StartStep) => {
    tap();
    if (k === 'hand') router.push('/hand/new');
    else if (k === 'session') router.push('/session');
    else if (k === 'bankroll') router.push('/bankroll');
    else if (k === 'festival') router.push('/festival');
    else {
      const last = [...hands].sort((a, b) => b.createdAt - a.createdAt)[0];
      router.push({ pathname: '/hand/[id]', params: { id: last.id } });
    }
  };
  const hide = () => {
    setHidden(true);
    AsyncStorage.setItem(HIDDEN, '1').catch(() => {});
  };

  return (
    <Card style={{ gap: S.sm }}>
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
      {START_STEPS.map((s) => (
        <Pressable key={s.key} disabled={done[s.key]} onPress={() => go(s.key)} accessibilityRole="button" accessibilityState={{ checked: done[s.key] }} style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <Ionicons name={done[s.key] ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done[s.key] ? C.accent : C.muted} />
          <T v="body" color={done[s.key] ? C.muted : C.text} style={{ flex: 1, textDecorationLine: done[s.key] ? 'line-through' : 'none' }}>
            {t(s.label)}
          </T>
          {s.key === 'hand' && !done.hand ? (
            <T v="monoS" color={C.textDim}>
              {hands.length}/3
            </T>
          ) : null}
          {done[s.key] ? null : <Ionicons name="chevron-forward" size={16} color={C.muted} />}
        </Pressable>
      ))}
    </Card>
  );
}
