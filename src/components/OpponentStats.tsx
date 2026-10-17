// VPIP / PFR / 3-bet for a known opponent, from the hands entered against them.
// Shown when you tap their seat during hand entry and on their profile.

import React from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { SMALL_SAMPLE, type OpponentStats } from '@/store/queries';
import { C, R, S } from '@/theme';

import { Row, T } from './ui';

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}` : '—');

export function OpponentStatsRow({ stats }: { stats: OpponentStats | undefined }) {
  if (!stats?.hands) {
    return (
      <T v="tiny" color={C.textDim}>
        {t('Sem mãos com ação pré-flop contra este jogador.')}
      </T>
    );
  }
  const small = stats.hands < SMALL_SAMPLE;
  const cells = [
    { label: 'VPIP', value: pct(stats.vpip, stats.hands) },
    { label: 'PFR', value: pct(stats.pfr, stats.hands) },
    { label: '3-bet', value: pct(stats.threeBet, stats.threeBetOpp) },
  ];
  return (
    <View style={{ gap: 6 }}>
      <Row gap={S.sm}>
        {cells.map((c) => (
          <View key={c.label} style={{ flex: 1, backgroundColor: C.surface2, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingVertical: 8, alignItems: 'center', gap: 2 }}>
            <T v="label">{c.label}</T>
            <T v="monoL" color={small ? C.textDim : C.text}>
              {c.value}
            </T>
          </View>
        ))}
      </Row>
      <T v="tiny" color={small ? C.warn : C.textDim}>
        {stats.hands === 1 ? t('1 mão') : t('{n} mãos', { n: stats.hands })}
        {small ? ' · ' + t('amostra pequena, é só uma pista') : ''}
      </T>
    </View>
  );
}
