// One look for "too few to trust" across the app: the numbers stay visible
// (never hidden), dimmed, with this pill or note beside them.
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View } from 'react-native';

import { Pill, T } from '@/components/ui';
import { t } from '@/i18n';
import { SMALL_SAMPLE } from '@/store/queries';
import { C } from '@/theme';

export function isSmallSample(n: number, min = SMALL_SAMPLE) {
  return n < min;
}

/** Text colour for a number built on `n` samples: muted while the sample is small. */
export function sampleColor(n: number, normal: string = C.textDim, min = SMALL_SAMPLE) {
  return isSmallSample(n, min) ? C.muted : normal;
}

/**
 * Nothing once there is enough. `pill` sits next to a number; `note` is a
 * line under a block of stats and says how far there is to go.
 */
export function SmallSample({ n, min = SMALL_SAMPLE, variant = 'pill', unit }: { n: number; min?: number; variant?: 'pill' | 'note'; unit?: string }) {
  if (!isSmallSample(n, min)) return null;
  if (variant === 'pill') return <Pill label={t('amostra pequena')} color={C.warn} icon="hourglass-outline" />;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }} accessibilityRole="text">
      <Ionicons name="hourglass-outline" size={13} color={C.warn} style={{ marginTop: 2 }} />
      <T v="small" color={C.muted} style={{ flex: 1 }}>
        {t('Amostra pequena: {n} de {min} {unit}. Por agora é só uma pista.', { n, min, unit: unit ?? t('mãos') })}
      </T>
    </View>
  );
}
