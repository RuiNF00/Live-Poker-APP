// Bankroll: the sessions brought in from lists of tournament results (import-results.tsx).
// Those lists hold only the cashes, so they stay out of the balance, profit and ROI until
// the player counts them here; and a list imported by mistake goes in one tap.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Button, Card, confirmAction, ListGroup, Row, T, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

export function CashListCard() {
  const { allSessions, settings, setSettings, deleteSession } = useStore();
  const list = useMemo(() => allSessions.filter((s) => s.cashList), [allSessions]);
  if (!list.length) return null;
  const n = list.length;
  const counted = settings.countCashLists === true;
  return (
    <Card tone="inset" style={{ gap: S.sm }}>
      <Row gap={S.sm}>
        <Ionicons name="trophy-outline" size={18} color={counted ? C.warn : C.textDim} />
        <T v="h3" style={{ flex: 1 }}>
          {n === 1 ? t('1 prémio de uma lista de resultados') : t('{n} prémios de listas de resultados', { n })}
        </T>
      </Row>
      <T v="small">{counted ? t('Contam no saldo, no lucro e no ROI, nunca no resultado por hora (não têm horas). Faltam os torneios sem prémio: os números ficam melhores do que são.') : t('Ficam fora do saldo, do lucro e do ROI: estas listas só mostram os torneios com prémio.')}</T>
      <ListGroup>
        <ToggleItem title={t('Contar nos resultados')} value={counted} onChange={(v) => setSettings({ countCashLists: v })} />
      </ListGroup>
      <View style={{ alignItems: 'flex-start' }}>
        <Button
          kind="ghost"
          size="sm"
          icon="trash-outline"
          title={n === 1 ? t('Apagar este prémio importado') : t('Apagar os {n} prémios importados', { n })}
          onPress={() =>
            confirmAction(
              n === 1 ? t('Apagar 1 prémio importado?') : t('Apagar {n} prémios importados?', { n }),
              t('Só saem os que vieram de listas de resultados. As tuas outras sessões ficam como estão.'),
              t('Apagar'),
              () => list.forEach((s) => deleteSession(s.id)),
            )
          }
        />
      </View>
    </Card>
  );
}
