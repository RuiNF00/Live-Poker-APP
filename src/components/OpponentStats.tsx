// VPIP / PFR / 3-bet for a known opponent, from the hands entered against them.
// Shown when you tap their seat during hand entry and on their profile.

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { GLOSSARY, type TermKey } from '@/data/glossary';
import { t } from '@/i18n';
import { type OpponentStats } from '@/store/queries';
import { C, R, S } from '@/theme';

import { Row, T } from './ui';
import { isSmallSample, sampleColor, SmallSample } from './SmallSample';

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}` : '—');

export function OpponentStatsRow({ stats }: { stats: OpponentStats | undefined }) {
  // Tapping a number explains it in one line under the row.
  const [term, setTerm] = useState<TermKey | null>(null);
  if (!stats?.hands) {
    return (
      <T v="tiny" color={C.textDim}>
        {t('Sem mãos com ação pré-flop contra este jogador.')}
      </T>
    );
  }
  const small = isSmallSample(stats.hands);
  const cells: { label: TermKey; value: string }[] = [
    { label: 'VPIP', value: pct(stats.vpip, stats.hands) },
    { label: 'PFR', value: pct(stats.pfr, stats.hands) },
    { label: '3-bet', value: pct(stats.threeBet, stats.threeBetOpp) },
  ];
  return (
    <View style={{ gap: 6 }}>
      <Row gap={S.sm}>
        {cells.map((c) => (
          <Pressable
            key={c.label}
            accessibilityRole="button"
            accessibilityLabel={`${c.label} ${c.value}`}
            accessibilityHint={t(GLOSSARY[c.label].line)}
            accessibilityState={{ expanded: term === c.label }}
            onPress={() => setTerm(term === c.label ? null : c.label)}
            style={{ flex: 1, backgroundColor: C.surface2, borderRadius: R.md, borderWidth: 1, borderColor: term === c.label ? C.borderStrong : C.border, paddingVertical: 8, alignItems: 'center', gap: 2 }}>
            <T v="label">{c.label}</T>
            <T v="monoL" color={sampleColor(stats.hands, C.text)}>
              {c.value}
            </T>
          </Pressable>
        ))}
      </Row>
      {term ? (
        <T v="small" color={C.text}>
          <T v="small" color={C.text} style={{ fontWeight: '700' }}>
            {term + ': '}
          </T>
          {t(GLOSSARY[term].line)}
        </T>
      ) : null}
      {small ? (
        <SmallSample n={stats.hands} variant="note" />
      ) : (
        <T v="tiny" color={C.textDim}>
          {t('{n} mãos', { n: stats.hands }) + ' · ' + t('Toca num número para o explicar')}
        </T>
      )}
    </View>
  );
}
