// Trips: festivals and card-room trips, each with the sessions played during
// it, what it cost (flights, hotel, food...) and what is left after that.

import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { Sheet } from '@/components/BankrollSheets';
import { TripForm, tripDates } from '@/components/TripSheets';
import { Button, Card, Empty, ListGroup, ListItem, Pill, Screen, Section, T } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { festivalName, getPlan, useFestivalPlan } from '@/store/festival-plan';
import { dayKey, notOver, useFestivals } from '@/store/my-festivals';
import { useStore, uid } from '@/store/store';
import { blankTrip, currentTrip, tripFromFestival, tripSummary } from '@/store/trip-math';
import type { Trip } from '@/store/types';
import { C, S } from '@/theme';

export default function TripsScreen() {
  const { trips, sessions, settings, saveTrip } = useStore();
  const { isPro, paywall } = usePro();
  const [edit, setEdit] = useState<Trip | null>(null);
  const hidden = !!settings.hideAmounts;
  const locked = !isPro && FREE.trips !== null && trips.length >= FREE.trips;
  const [now] = useState(() => Date.now());
  const on = currentTrip(trips, now);
  // The trip to suggest: the next festival with tournaments already in the plan, else the next one, never one with a trip.
  const open = useFestivals().filter((f) => notOver(f, dayKey(now)) && !trips.some((x) => x.festivalId === f.id));
  useFestivalPlan(open[0]?.id ?? '');
  const festival = open.find((f) => getPlan(f.id).picked.length) ?? open[0];

  const add = () => (locked ? paywall('trips') : setEdit(blankTrip(uid('tr_'), settings.currency)));
  const fromFestival = () => {
    if (locked) return paywall('trips');
    if (!festival) return;
    const x = tripFromFestival(uid('tr_'), festival, getPlan(festival.id), festival.currency !== settings.currency ? { currency: settings.currency, rate: 0 } : undefined);
    saveTrip(x);
    router.push(`/trips/${x.id}`);
  };
  const signed = (n: number, cur: string) => (hidden ? '•••' : (n > 0 ? '+' : '') + money(n, cur));

  return (
    <>
      <Stack.Screen options={{ title: t('Viagens'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        {trips.length === 0 ? (
          <Empty
            icon="airplane-outline"
            title={t('Quanto ganhaste mesmo na viagem?')}
            body={t('Junta as sessões de um festival e o que gastaste em voos, hotel e comida. Vês o resultado depois das despesas, na moeda da viagem e na tua.')}
            action={
              <View style={{ gap: S.sm, alignSelf: 'stretch', marginTop: S.sm }}>
                {festival ? <Button title={t('Criar viagem: {name}', { name: festivalName(festival, getPlan(festival.id)) })} icon="trophy-outline" onPress={fromFestival} /> : null}
                <Button title={t('Nova viagem')} icon="add" kind="secondary" onPress={add} />
              </View>
            }
          />
        ) : (
          <>
            {on ? (
              <Card tone="accent" style={{ gap: 2 }}>
                <T v="label">{t('Estás em viagem')}</T>
                <T v="h3">{on.name}</T>
              </Card>
            ) : null}
            <Section title={t('Viagens')} action={t('+ Nova')} onAction={add}>
              <ListGroup>
                {trips.map((x) => {
                  const s = tripSummary(x, sessions);
                  return (
                    <ListItem
                      key={x.id}
                      icon={x.festivalId ? 'trophy-outline' : 'airplane-outline'}
                      iconColor={C.accent}
                      title={x.name}
                      subtitle={[tripDates(x), s.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: s.sessions })].join(' · ')}
                      value={s.sessions || s.expenses ? signed(s.net, x.currency) : undefined}
                      valueColor={s.net >= 0 ? C.good : C.bad}
                      chevron
                      onPress={() => router.push(`/trips/${x.id}`)}
                    />
                  );
                })}
              </ListGroup>
            </Section>
            {festival ? <Button title={t('Criar viagem: {name}', { name: festivalName(festival, getPlan(festival.id)) })} icon="trophy-outline" kind="secondary" size="md" onPress={fromFestival} /> : null}
            {locked ? (
              <Card tone="inset" style={{ gap: S.sm }}>
                <Pill label="Pro" color={C.accent} style={{ alignSelf: 'flex-start' }} />
                <T v="small">{t('No plano grátis tens uma viagem. Com Pro, guardas todas e levas as despesas para o relatório.')}</T>
              </Card>
            ) : null}
          </>
        )}
      </Screen>
      <Sheet visible={!!edit} title={t('Nova viagem')} onClose={() => setEdit(null)}>
        {edit ? (
          <TripForm
            initial={edit}
            home={settings.currency}
            isNew
            onSave={(x) => {
              saveTrip(x);
              setEdit(null);
              router.push(`/trips/${x.id}`);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}
