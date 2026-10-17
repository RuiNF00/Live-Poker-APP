// Final-table deal calculator: stacks and remaining payouts in, ICM and chip-chop
// shares out. Works offline, no setup.

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card, Chip, ChipRow, Divider, NumField, Row, Section, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { chips, money } from '@/poker/format';
import { chipChop, icm } from '@/poker/icm';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

export default function ChopScreen() {
  const { settings, activeSession } = useStore();
  const cur = activeSession?.currency ?? settings.currency;
  // From tournament mode: players left, your stack and the payouts still to come.
  const q = useLocalSearchParams<{ n?: string; stack?: string; pays?: string }>();
  const nine = (list: number[]) => [...list, 0, 0, 0, 0, 0, 0, 0, 0, 0].slice(0, 9);
  const [n, setN] = useState(() => Math.min(9, Math.max(2, Number(q.n) || 3)));
  const [stacks, setStacks] = useState<number[]>(() => nine([Number(q.stack) || activeSession?.stack || 0]));
  const [pays, setPays] = useState<number[]>(() => nine((q.pays ?? '').split(',').map((x) => Number(x) || 0)));
  // The store loads after the first render: fill in your stack once it's there.
  const liveStack = activeSession?.stack ?? 0;
  useEffect(() => {
    if (liveStack) setStacks((l) => (l[0] ? l : [liveStack, ...l.slice(1)]));
  }, [liveStack]);
  const st = stacks.slice(0, n);
  const py = pays.slice(0, n);
  const ready = st.every((x) => x > 0) && py[0] > 0;
  const e = ready ? icm(st, py) : [];
  const c = ready ? chipChop(st, py) : [];
  const total = st.reduce((a, b) => a + b, 0);
  const setAt = (list: number[], set: (l: number[]) => void, i: number, v: number) => set(list.map((x, k) => (k === i ? v : x)));

  const name = (i: number) => (i === 0 ? t('Tu') : t('Jogador {n}', { n: i + 1 }));
  return (
    <>
      <Stack.Screen options={{ title: t('Calculadora de deal') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Section title={t('Jogadores que restam')}>
          <ChipRow>
            {[2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
              <Chip key={k} label={String(k)} active={n === k} onPress={() => setN(k)} style={{ minWidth: 44 }} />
            ))}
          </ChipRow>
        </Section>
        <Section title={t('Stacks e prémios ({currency})', { currency: cur })}>
          <Card style={{ gap: S.md }}>
            {st.map((_, i) => (
              <Row key={i} gap={S.sm} style={{ alignItems: 'flex-end' }}>
                <NumField label={name(i)} value={stacks[i]} onChange={(v) => setAt(stacks, setStacks, i, v)} />
                <NumField label={t('{n}º lugar', { n: i + 1 })} value={pays[i]} onChange={(v) => setAt(pays, setPays, i, v)} />
              </Row>
            ))}
          </Card>
        </Section>
        {ready ? (
          <Section title={t('Quanto recebe cada um')} hint={t('ICM protege os stacks curtos; chip chop favorece o chip leader. Um deal justo costuma ficar entre os dois.')}>
            <Card padded={false}>
              <Row style={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.sm }}>
                <T v="label" style={{ flex: 1.3 }}>
                  {t('Jogador')}
                </T>
                <T v="label" style={{ flex: 1, textAlign: 'right' }}>
                  ICM
                </T>
                <T v="label" style={{ flex: 1, textAlign: 'right' }}>
                  {t('Chip chop')}
                </T>
              </Row>
              {st.map((s, i) => (
                <View key={i}>
                  <Divider inset={S.lg} />
                  <Row style={{ paddingHorizontal: S.lg, paddingVertical: 12, backgroundColor: i === 0 ? C.accentSoft : undefined }}>
                    <View style={{ flex: 1.3 }}>
                      <T v="h3" color={i === 0 ? C.accent : C.text}>
                        {name(i)}
                      </T>
                      <T v="monoS">
                        {chips(s)} · {((s / total) * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </T>
                    </View>
                    <T v="mono" style={{ flex: 1, textAlign: 'right' }}>
                      {money(Math.round(e[i]), cur)}
                    </T>
                    <T v="mono" color={C.textDim} style={{ flex: 1, textAlign: 'right' }}>
                      {money(Math.round(c[i]), cur)}
                    </T>
                  </Row>
                </View>
              ))}
            </Card>
          </Section>
        ) : (
          <Card tone="inset" style={{ alignItems: 'center', gap: 6 }}>
            <Ionicons name="calculator-outline" size={22} color={C.muted} />
            <T v="small" style={{ textAlign: 'center' }}>
              {t('Preenche todos os stacks e pelo menos o 1º prémio.')}
            </T>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
