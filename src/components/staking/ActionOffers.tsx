// On the festival screen: the action packages for this festival, and a button to
// start one from the events the player has planned.

import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button, ListGroup, ListItem, Pill } from '@/components/ui';
import { t } from '@/i18n';
import type { Festival } from '@/poker/festivals';
import { money } from '@/poker/format';
import { newOffer, offerTotals, saveOffer, useOffers } from '@/store/action-offer';
import { uid } from '@/store/store';
import { C, S } from '@/theme';

export function ActionOffers({ f, picked }: { f: Festival; picked: string[] }) {
  const offers = useOffers().filter((o) => o.festivalId === f.id);
  const start = () => {
    const o = newOffer(f, picked, uid('o'));
    saveOffer(o);
    router.push({ pathname: '/action/[id]', params: { id: o.id } });
  };
  if (!offers.length)
    return (
      <Button
        kind="secondary"
        icon="people-outline"
        title={t('Vender ação deste festival')}
        sub={picked.length ? undefined : t('Marca primeiro os eventos que vais jogar')}
        onPress={start}
      />
    );
  return (
    <View style={{ gap: S.sm }}>
      <ListGroup>
        {offers.map((o) => {
          const tot = offerTotals(f, o);
          const pending = (o.reservations ?? []).filter((r) => r.status === 'pending').length;
          return (
            <ListItem
              key={o.id}
              icon="people-outline"
              iconColor={C.accent}
              title={t('Pacote de ação')}
              subtitle={[tot.events === 1 ? t('1 evento') : t('{n} eventos', { n: tot.events }), money(tot.price, f.currency), o.remote ? '' : t('por partilhar')].filter(Boolean).join(' · ')}
              right={pending ? <Pill label={t('{n} por confirmar', { n: pending })} color={C.warn} /> : undefined}
              chevron
              onPress={() => router.push({ pathname: '/action/[id]', params: { id: o.id } })}
            />
          );
        })}
      </ListGroup>
      <Button kind="ghost" size="sm" icon="add" title={t('Outro pacote')} onPress={start} />
    </View>
  );
}
