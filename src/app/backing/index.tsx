// The backer's side: every player you back, from the statements they sent you,
// with what's open, what they owe you, makeup, and their sessions running now.

import { router, Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { backedLabel, liveIds, useBackingTotals, useLiveSnapshots } from '@/components/staking/use-backing';
import { Button, Card, Empty, ListGroup, ListItem, Pill, Screen, Section, T } from '@/components/ui';
import { t } from '@/i18n';
import { chips, money } from '@/poker/format';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

export default function BackingScreen() {
  const { backing } = useStore();
  const sts = [...backing].map((b) => b.statement).sort((a, b) => Math.abs(b.bal) - Math.abs(a.bal) || a.pl.localeCompare(b.pl));
  const totals = useBackingTotals(sts);
  const snaps = useLiveSnapshots(liveIds(sts));
  const running = sts.flatMap((st) => st.rows.filter((r) => !r.e).map((r) => ({ st, r })));
  const add = () => router.push('/backing/add');

  return (
    <>
      <Stack.Screen options={{ title: t('Quem eu banco'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        {sts.length === 0 ? (
          <Empty
            icon="people-circle-outline"
            title={t('Segue quem bancas')}
            body={t('Quando um jogador te envia as contas da Sweatbook, guarda o link aqui. Vês a ação em aberto, o que te deve, o makeup e as sessões em direto, de todos num só sítio.')}
            action={<Button title={t('Colar o link das contas')} icon="clipboard-outline" onPress={add} />}
          />
        ) : (
          <>
            {[...totals.entries()].map(([cur, x]) => {
              const net = x.owed - x.owe;
              const lab = backedLabel(net, cur);
              const extra = [x.makeup >= 0.5 ? t('makeup {amount}', { amount: money(x.makeup, cur) }) : '', x.live ? (x.live === 1 ? t('1 sessão a decorrer') : t('{n} sessões a decorrer', { n: x.live })) : '']
                .filter(Boolean)
                .join(' · ');
              return (
                <Card key={cur} tone="raised" style={{ gap: S.xs, paddingVertical: S.xl }}>
                  <T v="label">{Math.abs(net) < 0.5 ? t('Estás acertado com os jogadores') : net > 0 ? t('No total, os jogadores devem-te') : t('No total, deves aos jogadores')}</T>
                  {Math.abs(net) < 0.5 ? null : (
                    <T v="monoXL" color={lab.color} numberOfLines={1} adjustsFontSizeToFit>
                      {money(Math.abs(net), cur)}
                    </T>
                  )}
                  {extra ? (
                    <T v="small" color={x.makeup >= 0.5 ? C.warn : undefined}>
                      {extra}
                    </T>
                  ) : null}
                </Card>
              );
            })}

            {running.length > 0 && (
              <Section title={t('A jogar agora')}>
                <ListGroup>
                  {running.map(({ st, r }, i) => {
                    const snap = r.l ? snaps.get(r.l) : undefined;
                    const playing = snap && !snap.endedAt;
                    return (
                      <ListItem
                        key={st.id + i}
                        left={<Avatar name={st.pl || '?'} />}
                        title={st.pl || t('Jogador')}
                        subtitle={[r.n || (r.k === 'mtt' ? t('Torneio') : 'Cash'), `${r.sh}%`, snap?.level ? t('Nível {n}', { n: snap.level }) : ''].filter(Boolean).join(' · ')}
                        right={
                          snap ? (
                            <View style={{ alignItems: 'flex-end', gap: 2 }}>
                              <T v="mono" style={{ fontSize: 15 }}>
                                {snap.endedAt ? money(snap.cashOut, snap.currency) : chips(snap.stack)}
                              </T>
                              <Pill label={playing ? (snap.paused ? t('Em pausa') : t('Em direto')) : t('Terminada')} color={playing && !snap.paused ? C.good : C.muted} icon="ellipse" />
                            </View>
                          ) : (
                            <T v="tiny">{r.l ? t('A carregar…') : t('Sem link em direto')}</T>
                          )
                        }
                        onPress={r.l ? () => router.push({ pathname: '/live/[id]', params: { id: r.l! } }) : undefined}
                      />
                    );
                  })}
                </ListGroup>
              </Section>
            )}

            <Section title={t('Jogadores')} action={t('+ Colar link')} onAction={add}>
              <ListGroup>
                {sts.map((st) => {
                  const lab = backedLabel(st.bal, st.cur);
                  const open = st.rows.filter((r) => !r.e).length;
                  const unpaid = st.rows.filter((r) => r.u).reduce((a, r) => a + r.c, 0);
                  return (
                    <ListItem
                      key={st.id}
                      left={<Avatar name={st.pl || '?'} />}
                      title={st.pl || t('Jogador')}
                      subtitle={
                        <View style={{ gap: 1 }}>
                          <T v="small" numberOfLines={1}>
                            {[st.rows.length === 1 ? t('1 sessão') : t('{n} sessões', { n: st.rows.length }), open ? t('{n} em aberto', { n: open }) : '', st.mk >= 0.5 ? t('makeup {amount}', { amount: money(st.mk, st.cur) }) : '']
                              .filter(Boolean)
                              .join(' · ')}
                          </T>
                          {unpaid >= 0.5 ? (
                            <T v="tiny" numberOfLines={1}>
                              {t('Ainda não pagaste {amount}', { amount: money(unpaid, st.cur) })}
                            </T>
                          ) : null}
                        </View>
                      }
                      right={
                        <View style={{ alignItems: 'flex-end', gap: 1 }}>
                          {lab.short ? (
                            <T v="tiny" color={lab.color}>
                              {lab.short}
                            </T>
                          ) : null}
                          <T v="mono" color={lab.color} style={{ fontSize: 15 }}>
                            {lab.short ? money(Math.abs(st.bal), st.cur) : lab.text}
                          </T>
                        </View>
                      }
                      onPress={() => router.push({ pathname: '/backing/[id]', params: { id: st.id } })}
                    />
                  );
                })}
              </ListGroup>
            </Section>
            <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
              {t('As contas são as que cada jogador te enviou. As sessões em direto atualizam sozinhas.')}
            </T>
          </>
        )}
      </Screen>
    </>
  );
}
