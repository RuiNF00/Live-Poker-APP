// Final-table deal calculator: stacks and remaining payouts in, ICM and chip-chop
// shares out. Works offline, no setup.

import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { NumField } from '@/components/entry/ContextSheet';
import { Chip, Panel, Row, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { chips, money } from '@/poker/format';
import { chipChop, icm } from '@/poker/icm';
import { useStore } from '@/store/store';
import { C, ff } from '@/theme';

export default function ChopScreen() {
  const { settings, activeSession } = useStore();
  const cur = activeSession?.currency ?? settings.currency;
  const [n, setN] = useState(3);
  const [stacks, setStacks] = useState<number[]>(() => [activeSession?.stack || 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [pays, setPays] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const st = stacks.slice(0, n);
  const py = pays.slice(0, n);
  const ready = st.every((x) => x > 0) && py[0] > 0;
  const e = ready ? icm(st, py) : [];
  const c = ready ? chipChop(st, py) : [];
  const total = st.reduce((a, b) => a + b, 0);
  const setAt = (list: number[], set: (l: number[]) => void, i: number, v: number) => set(list.map((x, k) => (k === i ? v : x)));

  return (
    <>
      <Stack.Screen options={{ title: t('Calculadora de deal') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <T v="label">{t('Jogadores que restam')}</T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {[2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
              <Chip key={k} label={String(k)} active={n === k} onPress={() => setN(k)} />
            ))}
          </Row>
        </View>
        <Panel style={{ gap: 10 }}>
          <Row gap={10}>
            <T v="label" style={{ flex: 1 }}>
              {t('Stacks')}
            </T>
            <T v="label" style={{ flex: 1 }}>
              {t('Prémios ({currency})', { currency: cur })}
            </T>
          </Row>
          {st.map((_, i) => (
            <Row key={i} gap={10}>
              <NumField label={i === 0 ? t('Tu') : t('Jogador {n}', { n: i + 1 })} value={stacks[i]} onChange={(v) => setAt(stacks, setStacks, i, v)} />
              <NumField label={t('{n}º lugar', { n: i + 1 })} value={pays[i]} onChange={(v) => setAt(pays, setPays, i, v)} />
            </Row>
          ))}
        </Panel>
        {ready ? (
          <Panel style={{ gap: 8 }}>
            <Row>
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
              <Row key={i}>
                <View style={{ flex: 1.3 }}>
                  <T v="body" style={{ fontWeight: '700', fontFamily: ff(700), color: i === 0 ? C.accent : C.text }}>
                    {i === 0 ? t('Tu') : t('Jogador {n}', { n: i + 1 })}
                  </T>
                  <T v="tiny">
                    {chips(s)} · {((s / total) * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </T>
                </View>
                <T v="mono" style={{ flex: 1, textAlign: 'right' }}>
                  {money(Math.round(e[i]), cur)}
                </T>
                <T v="mono" style={{ flex: 1, textAlign: 'right' }}>
                  {money(Math.round(c[i]), cur)}
                </T>
              </Row>
            ))}
            <T v="tiny" style={{ marginTop: 4 }}>
              {t('ICM protege os stacks curtos; chip chop favorece o chip leader. Um deal justo costuma ficar entre os dois.')}
            </T>
          </Panel>
        ) : (
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Preenche todos os stacks e pelo menos o 1º prémio.')}
          </T>
        )}
      </ScrollView>
    </>
  );
}
