// Staking: everyone who has a piece of your action, what you owe each other,
// their makeup, and the live link they can follow your sessions on.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BackerSheet, blankBacker } from '@/components/staking/sheets';
import { balanceLabel, useStaking } from '@/components/staking/use-staking';
import { Button, Card, Empty, ListGroup, ListItem, Pill, Row, Screen, Section, Stat, StatGrid, T } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import type { Backer } from '@/store/types';
import { C, S } from '@/theme';

export default function StakingScreen() {
  const { backers, saveBacker, settings, activeSession } = useStore();
  const { ledgers } = useStaking();
  const [edit, setEdit] = useState<Backer | null>(null);
  const cur = settings.currency;

  const all = [...ledgers.values()];
  const owe = all.reduce((a, l) => a + Math.max(0, l.balance), 0);
  const owed = all.reduce((a, l) => a + Math.max(0, -l.balance), 0);
  const makeup = all.reduce((a, l) => a + l.makeup, 0);
  const live = new Set(all.flatMap((l) => l.rows.filter((r) => !r.session.endedAt).map((r) => r.session.id))).size;
  const sorted = [...backers].sort((a, b) => Math.abs(ledgers.get(b.id)?.balance ?? 0) - Math.abs(ledgers.get(a.id)?.balance ?? 0) || a.name.localeCompare(b.name));

  return (
    <>
      <Stack.Screen options={{ title: 'Staking', headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        {backers.length === 0 ? (
          <Empty
            icon="people-outline"
            title={t('Vende ação com nome')}
            body={t('Junta os teus backers, vende pacotes de vários torneios e vê quanto deves a cada um, com makeup incluído.')}
            action={<Button title={t('Adicionar backer')} icon="person-add-outline" onPress={() => setEdit(blankBacker())} />}
          />
        ) : (
          <>
            <Card tone="raised" style={{ gap: S.md }}>
              <T v="label">{t('Contas com os backers')}</T>
              <Row gap={S.xl} style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="small">{t('Deves')}</T>
                  <T v="monoL" color={owe ? C.warn : C.textDim} numberOfLines={1} adjustsFontSizeToFit>
                    {money(owe, cur)}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="small">{t('Devem-te')}</T>
                  <T v="monoL" color={owed ? C.good : C.textDim} numberOfLines={1} adjustsFontSizeToFit>
                    {money(owed, cur)}
                  </T>
                </View>
              </Row>
            </Card>
            <StatGrid cols={3}>
              <Stat label="Backers" value={String(backers.length)} />
              <Stat label="Makeup" value={money(makeup, cur)} tone={makeup ? 'warn' : undefined} />
              <Stat label={t('A decorrer')} value={String(live)} />
            </StatGrid>

            <Section title="Backers" action={t('+ Novo')} onAction={() => setEdit(blankBacker())}>
              <ListGroup>
                {sorted.map((b) => {
                  const l = ledgers.get(b.id);
                  const bal = balanceLabel(l?.balance ?? 0, cur);
                  const n = l?.rows.length ?? 0;
                  return (
                    <ListItem
                      key={b.id}
                      left={<Avatar name={b.name} />}
                      title={b.name}
                      subtitle={
                        [n === 1 ? t('1 sessão') : t('{n} sessões', { n }), l?.makeup ? t('makeup {amount}', { amount: money(l.makeup, cur) }) : ''].filter(Boolean).join(' · ')
                      }
                      right={
                        <T v="mono" color={bal.color} style={{ fontSize: 14 }}>
                          {bal.text}
                        </T>
                      }
                      onPress={() => router.push({ pathname: '/staking/[id]', params: { id: b.id } })}
                    />
                  );
                })}
              </ListGroup>
            </Section>
          </>
        )}

        <Section title={t('Link em direto')}>
          <Card style={{ gap: S.md }}>
            <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="radio-outline" size={22} color={C.accent} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={S.sm}>
                  <T v="h3">{t('Os teus backers seguem a sessão')}</T>
                  {activeSession?.live ? <Pill label={t('Ligado')} color={C.good} icon="ellipse" /> : null}
                </Row>
                <T v="small">{t('Um link que abre no browser com o stack, o nível e o resultado, atualizado sempre que mexes na sessão. Não mostra notas, mãos nem os nomes dos backers.')}</T>
              </View>
            </Row>
            <Button
              size="md"
              kind={activeSession ? 'primary' : 'secondary'}
              icon={activeSession ? 'radio-outline' : 'timer-outline'}
              title={activeSession ? (activeSession.live ? t('Ver na sessão') : t('Criar link para esta sessão')) : t('Começa uma sessão para criar o link')}
              onPress={() => router.push('/session')}
            />
          </Card>
        </Section>
      </Screen>
      <BackerSheet
        backer={edit}
        onClose={() => setEdit(null)}
        onSave={(b) => {
          saveBacker(b);
          setEdit(null);
          router.push({ pathname: '/staking/[id]', params: { id: b.id } });
        }}
      />
    </>
  );
}
