import { router } from 'expo-router';
import React from 'react';

import { ListGroup, ListItem } from '@/components/ui';
import { t } from '@/i18n';
import { useStore } from '@/store/store';
import { C } from '@/theme';

import { splitMoney, useStaking } from './use-staking';

/** Row that opens Staking, with what you owe and are owed at a glance. */
export function StakingEntry() {
  const { backers } = useStore();
  const { totals } = useStaking();
  const sub = !backers.length
    ? t('Backers, pacotes, makeup e link em direto')
    : [totals.oweTo ? t('Deves {amount}', { amount: splitMoney(totals, 'owe') }) : '', totals.owedBy ? t('Devem-te {amount}', { amount: splitMoney(totals, 'owed') }) : ''].filter(Boolean).join(' · ') ||
      t('Tudo acertado');
  return (
    <ListGroup>
      <ListItem icon="people-outline" iconColor={C.accent} title="Staking" subtitle={sub} onPress={() => router.push('/staking')} />
    </ListGroup>
  );
}
