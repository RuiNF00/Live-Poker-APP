// On the live tournament screen: the swaps this tournament is in, or a swap for it in one tap
// (the new swap comes filled in with this tournament).

import { router } from 'expo-router';
import React from 'react';

import { ListItem } from '@/components/ui';
import { t } from '@/i18n';
import { groupsForSession } from '@/store/swap-groups';
import { useGroups } from '@/store/swap-groups-store';
import { other, swapNames, swapsForSession } from '@/store/swaps';
import { useSwaps } from '@/store/swaps-store';
import type { Session } from '@/store/types';
import { C } from '@/theme';

export function SwapLiveRow({ s }: { s: Session }) {
  const { swaps } = useSwaps();
  const { groups } = useGroups();
  // Matched as if it were over (still running: any end will do): the swaps that would ask for this result.
  const now = { ...s, endedAt: Number.MAX_SAFE_INTEGER };
  const pairs = swapsForSession(swaps, now);
  const gl = groupsForSession(groups, now);
  const names = [...pairs.map((x) => swapNames(x)[other(x.side)]), ...gl.map((g) => g.terms.title)];
  if (!names.length) {
    return <ListItem icon="swap-horizontal" iconColor={C.accent} title={t('Fazer um swap')} subtitle={t('Com este torneio já preenchido')} onPress={() => router.push('/swaps/new')} />;
  }
  const one = pairs.length + gl.length === 1;
  return (
    <ListItem
      icon="swap-horizontal"
      iconColor={C.accent}
      title={t('Swaps neste torneio')}
      subtitle={names.join(', ')}
      onPress={() =>
        one ? (pairs.length ? router.push({ pathname: '/swap/[id]', params: { id: pairs[0].id } }) : router.push({ pathname: '/swap/g/[id]', params: { id: gl[0].id } })) : router.push('/swaps')
      }
    />
  );
}
