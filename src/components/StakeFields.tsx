// Staking and expenses for a session: how much action was sold, at what markup,
// and costs outside the buy-in. Hidden behind one chip so the common case stays short.

import React, { useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import type { Session } from '@/store/types';

import { S } from '@/theme';

import { Button, Card, Chip, ChipRow, NumField, Row, Section } from './ui';

const SOLD = [0, 10, 20, 25, 30, 40, 50, 60, 75];
const MARKUP = [1, 1.05, 1.1, 1.15, 1.2, 1.3];

export function StakeFields({ s, onChange, expenses = true }: { s: Session; onChange: (p: Partial<Session>) => void; expenses?: boolean }) {
  const has = !!s.staking?.sold || !!s.expenses;
  const [open, setOpen] = useState(has);
  if (!open)
    return (
      <Button kind="ghost" size="sm" icon="add" style={{ alignSelf: 'flex-start' }} title={expenses ? t('Staking ou despesas') : 'Staking'} onPress={() => setOpen(true)} />
    );
  const sold = s.staking?.sold ?? 0;
  const markup = s.staking?.markup ?? 1;
  const setStake = (p: Partial<{ sold: number; markup: number }>) => {
    const next = { sold, markup, ...p };
    onChange({ staking: next.sold ? next : undefined });
  };
  return (
    <View style={{ gap: S.lg }}>
      <Section title={t('Ação vendida')}>
        <ChipRow>
          {SOLD.map((p) => (
            <Chip key={p} label={p ? `${p}%` : t('Nada')} active={sold === p} onPress={() => setStake({ sold: p })} />
          ))}
        </ChipRow>
      </Section>
      {sold > 0 && (
        <Section title="Markup">
          <ChipRow>
            {MARKUP.map((m) => (
              <Chip key={m} label={m === 1 ? t('Sem markup') : m.toFixed(2)} active={markup === m} onPress={() => setStake({ markup: m })} />
            ))}
          </ChipRow>
        </Section>
      )}
      {expenses && (
        <Card>
          <Row gap={S.sm}>
            <NumField label={t('Despesas ({currency})', { currency: s.currency })} value={s.expenses ?? 0} onChange={(v) => onChange({ expenses: v || undefined })} />
          </Row>
        </Card>
      )}
    </View>
  );
}
