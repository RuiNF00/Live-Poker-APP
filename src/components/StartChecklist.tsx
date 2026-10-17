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

/**
 * First-week checklist on the hands list (Mural pattern): four things that
 * make the app stick, each one tap away. Goes once all four are done, or
 * when the player hides it.
 */
export function StartChecklist() {
  const { hands, sessions, transfers } = useStore();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(HIDDEN)
      .then((v) => setHidden(v === '1'))
      .catch(() => setHidden(false));
  }, []);
  const done = startProgress({ hands, sessions: sessions.length, deposits: transfers.filter((x) => x.kind === 'deposit').length });
  const count = START_STEPS.filter((s) => done[s.key]).length;
  if (hidden || hands.length === 0 || count === START_STEPS.length) return null;

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
