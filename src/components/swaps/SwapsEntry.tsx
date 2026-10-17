import { router } from 'expo-router';
import React from 'react';

import { ListGroup, ListItem } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { swapsTotal } from '@/store/swaps';
import { useSwaps } from '@/store/swaps-store';
import { C } from '@/theme';

/** Row that opens Swaps, with where you stand at a glance. */
export function SwapsEntry() {
  const { swaps } = useSwaps();
  const tot = swapsTotal(swaps);
  const parts = [...tot.byCurrency.entries()]
    .filter(([, v]) => Math.abs(v.net) >= 0.5)
    .map(([cur, v]) => (v.net > 0 ? t('Devem-te {amount}', { amount: money(v.net, cur) }) : t('Deves {amount}', { amount: money(-v.net, cur) })));
  if (tot.pending) parts.push(tot.pending === 1 ? t('1 por confirmar') : t('{n} por confirmar', { n: tot.pending }));
  const sub = !swaps.length ? t('Percentagens com outros jogadores, confirmadas por link') : parts.join(' · ') || t('Tudo acertado');
  return (
    <ListGroup>
      <ListItem icon="swap-horizontal" iconColor={C.accent} title="Swaps" subtitle={sub} onPress={() => router.push('/swaps')} />
    </ListGroup>
  );
}
