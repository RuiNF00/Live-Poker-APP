// One player you back: the balance between you, their sessions with your piece,
// and the ones running now (tap to follow the live page).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Platform, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { markupLabel } from '@/components/staking/sheets';
import { backedLabel, useLiveSnapshots } from '@/components/staking/use-backing';
import { Amount, Button, Card, Empty, IconButton, ListGroup, ListItem, Pill, Row, Screen, Section, Stat, StatGrid, T } from '@/components/ui';
import { t } from '@/i18n';
import { chips, money, shortDate } from '@/poker/format';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

export default function BackedPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backing, deleteBacked } = useStore();
  const st = backing.find((b) => b.id === id)?.statement;
  const snaps = useLiveSnapshots(st ? st.rows.filter((r) => !r.e && r.l).map((r) => r.l!) : []);

  if (!st)
    return (
      <>
        <Stack.Screen options={{ title: t('Jogador') }} />
        <Screen contentStyle={{ paddingTop: S.lg }}>
          <Empty title={t('Este jogador já não está na tua lista')} action={<Button title={t('Voltar')} onPress={() => router.back()} />} />
        </Screen>
      </>
    );

  const cur = st.cur;
  const lab = backedLabel(st.bal, cur);
  const remove = () => {
    const go = () => {
      deleteBacked(st.id);
      router.back();
    };
    if (Platform.OS === 'web') go();
    else
      Alert.alert(t('Tirar {name} da lista?', { name: st.pl || t('Jogador') }), t('Se te voltar a enviar as contas, aparece outra vez.'), [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Tirar'), style: 'destructive', onPress: go },
      ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: st.pl || t('Jogador'),
          headerBackTitle: t('Voltar'),
          headerRight: () => <IconButton name="trash-outline" size={36} label={t('Tirar da lista')} onPress={remove} />,
        }}
      />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <Card tone="raised" style={{ gap: S.sm, alignItems: 'center', paddingVertical: S.xl }}>
          <Avatar name={st.pl || '?'} size={56} />
          <T v="monoXL" color={lab.color} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 34, lineHeight: 40 }}>
            {lab.text}
          </T>
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Contas enviadas por {name} a {date}', { name: st.pl || t('o jogador'), date: shortDate(st.at) })}
          </T>
        </Card>

        <StatGrid cols={3}>
          <Stat label={t('Custo')} value={money(st.inv, cur)} />
          <Stat label={t('Resultado')} value={money(st.res, cur)} tone={st.res > 0 ? 'good' : st.res < 0 ? 'bad' : undefined} />
          <Stat label="Makeup" value={money(st.mk, cur)} tone={st.mk ? 'warn' : undefined} />
        </StatGrid>

        <Section title={t('Sessões')}>
          <ListGroup>
            {st.rows.map((r, i) => {
              const snap = r.l ? snaps.get(r.l) : undefined;
              const net = r.o - r.c;
              return (
                <ListItem
                  key={i}
                  title={r.n || (r.k === 'mtt' ? t('Torneio') : 'Cash')}
                  subtitle={
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>
                      <T v="small">{[shortDate(r.d), `${r.sh}%`, r.mu !== 1 ? markupLabel(r.mu) : '', r.p ?? ''].filter(Boolean).join(' · ')}</T>
                      {!r.e ? <Pill label={snap?.paused ? t('Em pausa') : t('A decorrer')} color={snap?.paused ? C.warn : C.good} icon="ellipse" /> : null}
                      {r.u ? <Pill label={t('Por pagar {amount}', { amount: money(r.c, r.cu ?? cur) })} color={C.warn} /> : null}
                    </Row>
                  }
                  right={
                    r.e ? (
                      <Amount value={net} text={money(net, r.cu ?? cur)} style={{ fontSize: 14 }} />
                    ) : snap ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <T v="mono" style={{ fontSize: 14 }}>
                          {chips(snap.stack)}
                        </T>
                        <T v="tiny">{t('pagaste {amount}', { amount: money(r.c, r.cu ?? cur) })}</T>
                      </View>
                    ) : (
                      <T v="tiny">{t('pagaste {amount}', { amount: money(r.c, r.cu ?? cur) })}</T>
                    )
                  }
                  chevron={!!r.l}
                  onPress={r.l ? () => router.push({ pathname: '/live/[id]', params: { id: r.l! } }) : undefined}
                />
              );
            })}
          </ListGroup>
        </Section>
        <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg, paddingBottom: S.lg }}>
          {t('Para atualizar as contas, pede a {name} que te envie as contas outra vez.', { name: st.pl || t('o jogador') })}
        </T>
      </Screen>
    </>
  );
}
