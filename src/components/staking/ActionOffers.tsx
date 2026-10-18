// On the festival screen: the action the player has sold for this festival
// (logged per backer), and a button to log it from the events they planned.

import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { View } from 'react-native';

import { Button, ListGroup, ListItem, Pill } from '@/components/ui';
import { t } from '@/i18n';
import type { Festival } from '@/poker/festivals';
import { money } from '@/poker/format';
import { deleteOffer, getOffers, newOffer, offerTotals, saveOffer, useOffers } from '@/store/action-offer';
import { uid } from '@/store/store';
import { C, S } from '@/theme';

export function ActionOffers({ f, picked }: { f: Festival; picked: string[] }) {
  // A package left without backers (opened, then back) is nothing sold: hidden, and gone once the player is back here.
  const offers = useOffers().filter((o) => o.festivalId === f.id && o.lines.length > 0);
  // Only when the screen comes back into focus: the package just opened by «Registar» must survive until then.
  useFocusEffect(
    useCallback(() => {
      getOffers()
        .filter((o) => o.festivalId === f.id && o.lines.length === 0)
        .forEach((o) => deleteOffer(o.id));
    }, [f.id]),
  );
  const start = () => {
    const o = newOffer(f, picked, uid('o'));
    saveOffer(o);
    // Straight to the first backer: most of the time it's the one from last time.
    router.push({ pathname: '/action/[id]', params: { id: o.id, add: '1' } });
  };
  if (!offers.length)
    return (
      <Button
        kind="secondary"
        icon="people-outline"
        title={t('Registar ação vendida')}
        sub={picked.length ? undefined : t('Marca primeiro os torneios que vais jogar')}
        onPress={start}
      />
    );
  return (
    <View style={{ gap: S.sm }}>
      <ListGroup>
        {offers.map((o) => {
          const tot = offerTotals(f, o);
          const waiting = o.lines.filter((l) => l.remote && !l.confirmedAt).length;
          return (
            <ListItem
              key={o.id}
              icon="people-outline"
              iconColor={C.accent}
              title={t('Ação vendida: {pct}%', { pct: String(tot.sold).replace('.', ',') })}
              subtitle={[o.lines.length === 1 ? t('1 backer') : t('{n} backers', { n: o.lines.length }), tot.events === 1 ? t('1 torneio') : t('{n} torneios', { n: tot.events }), money(tot.price, f.currency)].join(' · ')}
              right={waiting ? <Pill label={t('{n} por confirmar', { n: waiting })} color={C.warn} /> : undefined}
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
