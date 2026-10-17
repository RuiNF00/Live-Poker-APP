// Swaps: percentages swapped with other players, each confirmed by both through a link,
// and where you stand with each of them.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { AccountsLocked, PAIR, pctLabel } from '@/components/swaps/parts';
import { Button, Card, Empty, ListGroup, ListItem, Pill, Row, Screen, Section, T, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { assignGroups, groupLedger, groupReady, type SwapGroup } from '@/store/swap-groups';
import { syncAllGroups, useGroups } from '@/store/swap-groups-store';
import { assignSwaps, other, settled, swapLedger, swapNames, swapsTotal, type Swap } from '@/store/swaps';
import { syncAllSwaps, useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';
import { useLocked } from '@/components/ProGate';

function SwapsScreen() {
  const { swaps, ready } = useSwaps();
  const { groups } = useGroups();
  const { sessions, settings, setSettings } = useStore();
  const include = settings.includeSwaps !== false;
  const loose = include ? assignSwaps(sessions, swaps).unassigned.length + assignGroups(sessions, groups).unassigned.length : 0;
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(
    useCallback(() => {
      syncAllSwaps();
      syncAllGroups();
    }, []),
  );
  const tot = swapsTotal(swaps);
  // Groups add to the same per-currency totals: what the group owes me, or what I owe it.
  for (const g of groups) {
    if (g.archived || g.gone || !groupReady(g)) continue;
    tot.open++;
    const b = groupLedger(g).balance;
    const cur = tot.byCurrency.get(g.terms.currency) ?? { owedToMe: 0, iOwe: 0, net: 0 };
    if (b > 0) cur.owedToMe += b;
    else cur.iOwe -= b;
    cur.net = Math.round((cur.owedToMe - cur.iOwe) * 100) / 100;
    tot.byCurrency.set(g.terms.currency, cur);
  }
  tot.pending += groups.filter((g) => !g.archived && !g.gone && !groupReady(g)).length;
  const active = swaps.filter((s) => !s.archived && !s.gone);
  const past = swaps.filter((s) => s.archived || s.gone);
  const activeGroups = groups.filter((g) => !g.archived && !g.gone);
  const pastGroups = groups.filter((g) => g.archived || g.gone);
  const locked = useLocked('swaps');
  const totals = locked ? [] : [...tot.byCurrency.entries()].filter(([, v]) => Math.abs(v.net) >= 0.5);
  const any = swaps.length + groups.length > 0;
  const newGroup = () => router.push('/swaps/group-new');

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
        {ready && !any ? (
          <Empty
            icon="swap-horizontal"
            title={t('Swaps por escrito')}
            body={t('Combina uma percentagem com outro jogador para um evento ou para a série toda. Ele confirma por link, os termos e a hora ficam fixados, e quando alguém cobra a app diz quem deve a quem.')}
            action={
              <View style={{ gap: S.sm, alignSelf: 'stretch' }}>
                <Button lines={2} title={t('Novo swap')} icon="add" onPress={() => router.push('/swaps/new')} />
                <Button lines={2} title={t('Swap de grupo')} kind="secondary" icon="people-outline" onPress={newGroup} />
              </View>
            }
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
                  {/* With only archived swaps the heading is "Swaps" itself: no eyebrow repeating it. */}
                  {tot.open || tot.pending ? <T v="label">{t('Swaps')}</T> : null}
                  <T v="h1">{locked && tot.open ? (tot.open === 1 ? t('1 swap ativo') : t('{n} swaps ativos', { n: tot.open })) : tot.open ? t('Tudo acertado') : tot.pending ? t('À espera de confirmação') : t('Swaps')}</T>
                </>
              )}
              <T v="small">
                {[locked ? '' : tot.open === 1 ? t('1 swap ativo') : tot.open ? t('{n} swaps ativos', { n: tot.open }) : '', tot.pending ? (tot.pending === 1 ? t('1 por confirmar') : t('{n} por confirmar', { n: tot.pending })) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            </Card>
            {locked && tot.open ? <AccountsLocked /> : null}

            <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
              <Button lines={2} title={t('Novo swap')} icon="add" style={PAIR} onPress={() => router.push('/swaps/new')} />
              <Button lines={2} title={t('Grupo')} kind="secondary" icon="people-outline" style={PAIR} onPress={newGroup} />
            </Row>
            {tot.open || activeGroups.length ? (
              <ListGroup>
                <ListItem
                  left={<Ionicons name="analytics-outline" size={22} color={C.accent} />}
                  title={t('Histórico de swaps')}
                  subtitle={t('Quanto ganhaste ou perdeste com swaps, por parceiro e por série')}
                  onPress={() => router.push('/swaps/history')}
                />
              </ListGroup>
            ) : null}

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
                    subtitle={t('A tua % sai da sessão onde cobraste; a tua parte dos prémios da outra pessoa entra na tua última sessão. Conta na bankroll, nos ganhos por hora e nos relatórios.')}
                    value={include}
                    onChange={(v) => setSettings({ includeSwaps: v })}
                  />
                </ListGroup>
              </Section>
            ) : null}

            {active.length || activeGroups.length ? (
              <Section title={t('Ativos')}>
                <ListGroup>
                  {activeGroups.map((g) => (
                    <GroupRow key={g.id} g={g} locked={locked && !g.accounts} />
                  ))}
                  {active.map((s) => (
                    <SwapRow key={s.id} s={s} locked={locked && !s.accounts} />
                  ))}
                </ListGroup>
              </Section>
            ) : null}
            {past.length || pastGroups.length ? (
              <Section title={t('Arquivo')}>
                <ListGroup>
                  {pastGroups.map((g) => (
                    <GroupRow key={g.id} g={g} locked={locked && !g.accounts} />
                  ))}
                  {past.map((s) => (
                    <SwapRow key={s.id} s={s} locked={locked && !s.accounts} />
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

function SwapRow({ s, locked }: { s: Swap; locked: boolean }) {
  const names = swapNames(s);
  const them = names[other(s.side)];
  const l = swapLedger(s);
  const cur = s.terms.currency;
  const square = settled(l);
  const right = !s.confirmedAt ? (
    <Pill label={s.gone ? t('Apagado') : t('Por confirmar')} color={s.gone ? C.muted : C.warn} />
  ) : locked ? (
    <Ionicons name="lock-closed-outline" size={16} color={C.muted} />
  ) : (
    // Capped, so a long amount at large text can't squeeze the name to nothing.
    <View style={{ alignItems: 'flex-end', gap: 1, maxWidth: '45%' }}>
      {square ? null : (
        <T v="tiny" color={l.balance > 0 ? C.good : C.warn}>
          {l.balance > 0 ? t('deve-te') : t('deves')}
        </T>
      )}
      <T v="mono" color={square ? C.textDim : l.balance > 0 ? C.good : C.warn} style={{ fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit>
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


function GroupRow({ g, locked }: { g: SwapGroup; locked: boolean }) {
  const ready = groupReady(g);
  const l = groupLedger(g);
  const cur = g.terms.currency;
  const square = Math.abs(l.balance) < 0.5;
  const missing = g.seats.filter((s) => !s.confirmedAt).length;
  const right = !ready ? (
    <Pill label={g.gone ? t('Apagado') : t('Faltam {n}', { n: missing })} color={g.gone ? C.muted : C.warn} />
  ) : locked ? (
    <Ionicons name="lock-closed-outline" size={16} color={C.muted} />
  ) : (
    // Capped, so a long amount at large text can't squeeze the name to nothing.
    <View style={{ alignItems: 'flex-end', gap: 1, maxWidth: '45%' }}>
      {square ? null : (
        <T v="tiny" color={l.balance > 0 ? C.good : C.warn}>
          {l.balance > 0 ? t('devem-te') : t('deves')}
        </T>
      )}
      <T v="mono" color={square ? C.textDim : l.balance > 0 ? C.good : C.warn} style={{ fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit>
        {square ? t('Acertado') : money(Math.abs(l.balance), cur)}
      </T>
    </View>
  );
  return (
    <ListItem
      left={
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people" size={20} color={C.accent} />
        </View>
      }
      title={g.terms.title}
      subtitle={
        <T v="small" numberOfLines={1}>
          {t('{n} jogadores · {pct} cada', { n: g.seats.length, pct: pctLabel(g.terms.pct) })}
        </T>
      }
      right={right}
      onPress={() => router.push({ pathname: '/swap/g/[id]', params: { id: g.id } })}
    />
  );
}

export default SwapsScreen;
