import { router } from 'expo-router';
import React from 'react';

import { ListGroup, ListItem } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { currentTrip, tripSummary } from '@/store/trip-math';
import { C } from '@/theme';

/** Row that opens Trips: the trip you're on (or the last one) and what's left after expenses. */
export function TripsEntry() {
  const { trips, sessions, settings } = useStore();
  const on = currentTrip(trips);
  const x = on ?? trips[0];
  const s = x ? tripSummary(x, sessions) : null;
  const net = s && (s.sessions || s.expenses) ? (settings.hideAmounts ? '•••' : (s.net > 0 ? '+' : '') + money(Math.round(s.net), s.currency)) : '';
  const sub = !x ? t('Festivais, voos, hotel e o que sobra no fim') : net ? t('{name}: {amount} depois das despesas', { name: x.name, amount: net }) : x.name;
  return (
    <ListGroup>
      <ListItem icon="airplane-outline" iconColor={C.info} title={t('Viagens')} subtitle={sub} chevron onPress={() => router.push(on ? `/trips/${on.id}` : '/trips')} />
    </ListGroup>
  );
}
