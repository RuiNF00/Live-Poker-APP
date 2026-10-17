// Every festival in the planner: the ones we ship (official dates, or the month
// they usually run in) and the ones the player added, coming first, then past.

import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';

import { FestivalItem } from '@/components/FestivalItem';
import { Button, ListGroup, Screen, Section, T } from '@/components/ui';
import { t } from '@/i18n';
import { dayKey, notOver, useFestivals } from '@/store/my-festivals';
import { S } from '@/theme';

export default function FestivalsScreen() {
  const festivals = useFestivals();
  const [today] = useState(() => dayKey(Date.now()));
  const [coming, past] = useMemo(() => [festivals.filter((f) => notOver(f, today)), festivals.filter((f) => !notOver(f, today)).reverse()], [festivals, today]);
  return (
    <>
      <Stack.Screen options={{ title: t('Festivais'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <T v="small" style={{ marginTop: -S.sm }}>
          {t('O calendário só tem datas publicadas pelos organizadores. Joga outro festival? Adiciona-o: a viagem e o planeador funcionam da mesma forma.')}
        </T>
        <Button title={t('Adicionar o meu festival')} icon="add" kind="secondary" onPress={() => router.push('/festival-new')} />
        {coming.length ? (
          <Section title={t('Próximos')}>
            <ListGroup>
              {coming.map((f) => (
                <FestivalItem key={f.id} f={f} />
              ))}
            </ListGroup>
          </Section>
        ) : null}
        {past.length ? (
          <Section title={t('Já passaram')}>
            <ListGroup>
              {past.map((f) => (
                <FestivalItem key={f.id} f={f} />
              ))}
            </ListGroup>
          </Section>
        ) : null}
      </Screen>
    </>
  );
}
