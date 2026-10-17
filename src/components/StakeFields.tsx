// Staking and expenses for a session: how much action was sold, at what markup,
// and costs outside the buy-in. Hidden behind one chip so the common case stays short.

import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { t } from '@/i18n';
import type { Session } from '@/store/types';

import { NumField } from './entry/ContextSheet';
import { Chip, Row, T } from './ui';

const SOLD = [0, 10, 20, 25, 30, 40, 50, 60, 75];
const MARKUP = [1, 1.05, 1.1, 1.15, 1.2, 1.3];

export function StakeFields({ s, onChange, expenses = true }: { s: Session; onChange: (p: Partial<Session>) => void; expenses?: boolean }) {
  const has = !!s.staking?.sold || !!s.expenses;
  const [open, setOpen] = useState(has);
  if (!open)
    return (
      <Row gap={6}>
        <Chip label={expenses ? t('+ Staking ou despesas') : t('+ Staking')} onPress={() => setOpen(true)} />
      </Row>
    );
  const sold = s.staking?.sold ?? 0;
  const markup = s.staking?.markup ?? 1;
  const setStake = (p: Partial<{ sold: number; markup: number }>) => {
    const next = { sold, markup, ...p };
    onChange({ staking: next.sold ? next : undefined });
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 6 }}>
        <T v="label">{t('Ação vendida')}</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {SOLD.map((p) => (
            <Chip key={p} label={p ? `${p}%` : t('Nada')} active={sold === p} onPress={() => setStake({ sold: p })} />
          ))}
        </ScrollView>
      </View>
      {sold > 0 && (
        <View style={{ gap: 6 }}>
          <T v="label">Markup</T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {MARKUP.map((m) => (
              <Chip key={m} label={m === 1 ? t('Sem markup') : m.toFixed(2)} active={markup === m} onPress={() => setStake({ markup: m })} />
            ))}
          </Row>
        </View>
      )}
      {expenses && (
        <Row gap={10}>
          <NumField label={t('Despesas ({currency})', { currency: s.currency })} value={s.expenses ?? 0} onChange={(v) => onChange({ expenses: v || undefined })} />
        </Row>
      )}
    </View>
  );
}
