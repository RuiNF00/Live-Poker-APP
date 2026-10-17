import { router } from 'expo-router';
import React from 'react';

import { ListGroup, ListItem } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { HALF_CENT } from '@/store/swap-groups';
import { swapsTotal } from '@/store/swaps';
import { useGroups } from '@/store/swap-groups-store';
import { useSwaps } from '@/store/swaps-store';
import { useLocked } from '@/components/ProGate';
import { C } from '@/theme';

/** Row that opens Swaps, with where you stand at a glance. */
export function SwapsEntry() {
  const { swaps } = useSwaps();
  const { groups } = useGroups();
  const locked = useLocked('swaps');
  const tot = swapsTotal(swaps, groups);
  // Without Pro the amounts stay in the app's Pro screens; the row still counts what's open.
  const parts = [...(locked ? [] : tot.byCurrency.entries())]
    .filter(([, v]) => Math.abs(v.net) >= HALF_CENT)
    .map(([cur, v]) => (v.net > 0 ? t('Devem-te {amount}', { amount: money(v.net, cur) }) : t('Deves {amount}', { amount: money(-v.net, cur) })));
  if (locked && tot.open) parts.push(tot.open === 1 ? t('1 swap ativo') : t('{n} swaps ativos', { n: tot.open }));
  if (tot.pending) parts.push(tot.pending === 1 ? t('1 por confirmar') : t('{n} por confirmar', { n: tot.pending }));
  const sub = !swaps.length && !groups.length ? t('Percentagens com outros jogadores, confirmadas por link') : parts.join(' · ') || t('Tudo acertado');
  return (
    <ListGroup>
      <ListItem icon="swap-horizontal" iconColor={C.accent} title="Swaps" subtitle={sub} onPress={() => router.push('/swaps')} />
    </ListGroup>
  );
}
