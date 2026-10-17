import { router } from 'expo-router';
import React from 'react';

import { ListGroup, ListItem } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { C } from '@/theme';

import { useStaking } from './use-staking';

/** Row that opens Staking, with what you owe and are owed at a glance. */
export function StakingEntry() {
  const { backers, settings } = useStore();
  const { ledgers } = useStaking();
  const all = [...ledgers.values()];
  const owe = all.reduce((a, l) => a + Math.max(0, l.balance), 0);
  const owed = all.reduce((a, l) => a + Math.max(0, -l.balance), 0);
  const cur = settings.currency;
  const sub = !backers.length
    ? t('Backers, pacotes, makeup e link em direto')
    : [owe >= 0.5 ? t('Deves {amount}', { amount: money(owe, cur) }) : '', owed >= 0.5 ? t('Devem-te {amount}', { amount: money(owed, cur) }) : ''].filter(Boolean).join(' · ') ||
      t('Tudo acertado');
  return (
    <ListGroup>
      <ListItem icon="people-outline" iconColor={C.accent} title="Staking" subtitle={sub} onPress={() => router.push('/staking')} />
    </ListGroup>
  );
}
