// Swaps: percentages swapped with other players, each confirmed by both through a link,
// and where you stand with each of them.

import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { pctLabel } from '@/components/swaps/parts';
import { Button, Card, Empty, ListGroup, ListItem, Pill, Row, Screen, Section, T, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { assignSwaps, other, settled, swapLedger, swapNames, swapsTotal, type Swap } from '@/store/swaps';
import { syncAllSwaps, useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';
import { withPro } from '@/components/ProGate';

function SwapsScreen() {
  const { swaps, ready } = useSwaps();
  const { sessions, settings, setSettings } = useStore();
  const include = settings.includeSwaps !== false;
  const loose = include ? assignSwaps(sessions, swaps).unassigned.length : 0;
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(
    useCallback(() => {
      syncAllSwaps();
    }, []),
  );
  const tot = swapsTotal(swaps);
  const active = swaps.filter((s) => !s.archived && !s.gone);
  const past = swaps.filter((s) => s.archived || s.gone);
  const totals = [...tot.byCurrency.entries()].filter(([, v]) => Math.abs(v.net) >= 0.5);

  return (
    <>
      <Stack.Screen options={{ title: 'Swaps', headerBackTitle: t('Voltar') }} />
      <Screen
        contentStyle={{ paddingTop: S.lg }}
        refreshControl={
          <RefreshControl
            tintColor={C.muted}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await syncAllSwaps();
              setRefreshing(false);
            }}
          />
        }>
        {ready && !swaps.length ? (
          <Empty
            icon="swap-horizontal"
            title={t('Swaps por escrito')}
            body={t('Combina uma percentagem com outro jogador para um evento ou para a série toda. Ele confirma por link, os termos e a hora ficam fixados, e quando alguém cobra a app diz quem deve a quem.')}
            action={<Button title={t('Novo swap')} icon="add" onPress={() => router.push('/swaps/new')} />}
          />
        ) : (
          <>
            <Card tone="raised" style={{ gap: S.xs, paddingVertical: S.xl }}>
              {totals.length ? (
                totals.map(([cur, v], i) => (
                  <View key={cur} style={{ gap: 2, marginTop: i ? S.sm : 0 }}>
                    <T v="label">{v.net > 0 ? t('No total, devem-te') : t('No total, deves')}</T>
                    <T v="monoXL" color={v.net > 0 ? C.good : C.warn} numberOfLines={1} adjustsFontSizeToFit>
                      {money(Math.abs(v.net), cur)}
                    </T>
                    {v.owedToMe >= 0.5 && v.iOwe >= 0.5 ? (
                      <T v="small">{t('devem-te {a} · deves {b}', { a: money(v.owedToMe, cur), b: money(v.iOwe, cur) })}</T>
                    ) : null}
                  </View>
                ))
              ) : (
                <>
                  <T v="label">{t('Swaps')}</T>
                  <T v="h1">{tot.open ? t('Tudo acertado') : t('À espera de confirmação')}</T>
                </>
              )}
              <T v="small">
                {[tot.open === 1 ? t('1 swap ativo') : tot.open ? t('{n} swaps ativos', { n: tot.open }) : '', tot.pending ? (tot.pending === 1 ? t('1 por confirmar') : t('{n} por confirmar', { n: tot.pending })) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            </Card>

            <Button title={t('Novo swap')} icon="add" onPress={() => router.push('/swaps/new')} />

            {tot.open ? (
              <Section
                hint={
                  loose
                    ? loose === 1
                      ? t('1 prémio ainda não entra: falta uma sessão tua terminada nessa moeda, desde o início do swap.')
                      : t('{n} prémios ainda não entram: falta uma sessão tua terminada nessa moeda, desde o início do swap.', { n: loose })
                    : undefined
                }>
                <ListGroup>
                  <ToggleItem
                    icon="stats-chart-outline"
                    title={t('Incluir swaps no resultado')}
                    subtitle={t('A tua % sai da sessão onde cobraste; a tua parte dos prémios dele entra na tua última sessão. Conta na bankroll, no €/h e nos relatórios.')}
                    value={include}
                    onChange={(v) => setSettings({ includeSwaps: v })}
                  />
                </ListGroup>
              </Section>
            ) : null}

            {active.length ? (
              <Section title={t('Ativos')}>
                <ListGroup>
                  {active.map((s) => (
                    <SwapRow key={s.id} s={s} />
                  ))}
                </ListGroup>
              </Section>
            ) : null}
            {past.length ? (
              <Section title={t('Arquivo')}>
                <ListGroup>
                  {past.map((s) => (
                    <SwapRow key={s.id} s={s} />
                  ))}
                </ListGroup>
              </Section>
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}

function SwapRow({ s }: { s: Swap }) {
  const names = swapNames(s);
  const them = names[other(s.side)];
  const l = swapLedger(s);
  const cur = s.terms.currency;
  const square = settled(l);
  const right = !s.confirmedAt ? (
    <Pill label={s.gone ? t('Apagado') : t('Por confirmar')} color={s.gone ? C.muted : C.warn} />
  ) : (
    <View style={{ alignItems: 'flex-end', gap: 1 }}>
      {square ? null : (
        <T v="tiny" color={l.balance > 0 ? C.good : C.warn}>
          {l.balance > 0 ? t('deve-te') : t('deves')}
        </T>
      )}
      <T v="mono" color={square ? C.textDim : l.balance > 0 ? C.good : C.warn} style={{ fontSize: 15 }}>
        {square ? t('Acertado') : money(Math.abs(l.balance), cur)}
      </T>
    </View>
  );
  const pct = s.terms.a.pct === s.terms.b.pct ? pctLabel(s.terms.a.pct) : `${pctLabel(s.terms[s.side].pct)} × ${pctLabel(s.terms[other(s.side)].pct)}`;
  return (
    <ListItem
      left={<Avatar name={them} />}
      title={them}
      subtitle={
        <Row gap={4}>
          <T v="small" numberOfLines={1} style={{ flexShrink: 1 }}>
            {[pct, s.terms.title].join(' · ')}
          </T>
        </Row>
      }
      right={right}
      onPress={() => router.push({ pathname: '/swap/[id]', params: { id: s.id } })}
    />
  );
}

export default withPro('swaps', t('Swaps'), SwapsScreen);
