// Staking: everyone who has a piece of your action, what you owe each other,
// their makeup, and the live link they can follow your sessions on.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BackerSheet, blankBacker } from '@/components/staking/sheets';
import { balanceLabel, useStaking } from '@/components/staking/use-staking';
import { Button, Card, Empty, ListGroup, ListItem, Pill, Row, Screen, Section, T } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import type { BackerLedger } from '@/store/staking';
import type { Backer } from '@/store/types';
import { C, S } from '@/theme';

export default function StakingScreen() {
  const { backers, backing, saveBacker, settings, activeSession } = useStore();
  const { ledgers } = useStaking();
  const [edit, setEdit] = useState<Backer | null>(null);
  const cur = settings.currency;

  const all = [...ledgers.values()];
  const owe = all.reduce((a, l) => a + Math.max(0, l.balance), 0);
  const owed = all.reduce((a, l) => a + Math.max(0, -l.balance), 0);
  const net = owe - owed;
  const oweTo = all.filter((l) => l.balance >= 0.5).length;
  const owedBy = all.filter((l) => l.balance <= -0.5).length;
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
            title={t('Regista a ação que vendes, com nome')}
            body={t('Junta os teus backers, regista pacotes de vários torneios e vê quanto deves a cada um, com makeup incluído.')}
            action={<Button title={t('Adicionar backer')} icon="person-add-outline" onPress={() => setEdit(blankBacker())} />}
          />
        ) : (
          <>
            <BalanceHeadline net={net} owe={owe} owed={owed} oweTo={oweTo} owedBy={owedBy} makeup={makeup} live={live} currency={cur} />

            <Section title="Backers" action={t('+ Novo')} onAction={() => setEdit(blankBacker())}>
              <ListGroup>
                {sorted.map((b) => {
                  const l = ledgers.get(b.id);
                  const bal = { ...balanceLabel(l?.balance ?? 0, cur), owe: (l?.balance ?? 0) > 0 };
                  const square = Math.abs(l?.balance ?? 0) < 0.5;
                  const n = l?.rows.length ?? 0;
                  return (
                    <ListItem
                      key={b.id}
                      left={<Avatar name={b.name} />}
                      title={b.name}
                      subtitle={
                        <View style={{ gap: 1 }}>
                          <T v="small" numberOfLines={1}>
                            {[n === 1 ? t('1 sessão') : t('{n} sessões', { n }), l?.makeup ? t('makeup {amount}', { amount: money(l.makeup, cur) }) : ''].filter(Boolean).join(' · ')}
                          </T>
                          {l && parts(l, cur) ? (
                            <T v="tiny" numberOfLines={1}>
                              {parts(l, cur)}
                            </T>
                          ) : null}
                        </View>
                      }
                      right={
                        <View style={{ alignItems: 'flex-end', gap: 1 }}>
                          {square ? null : (
                            <T v="tiny" color={bal.color}>
                              {bal.owe ? t('deves') : t('deve-te')}
                            </T>
                          )}
                          <T v="mono" color={bal.color} style={{ fontSize: 15 }}>
                            {square ? t('Acertado') : money(Math.abs(l?.balance ?? 0), cur)}
                          </T>
                        </View>
                      }
                      onPress={() => router.push({ pathname: '/staking/[id]', params: { id: b.id } })}
                    />
                  );
                })}
              </ListGroup>
            </Section>
          </>
        )}

        <Section title={t('Quem eu banco')}>
          <ListGroup>
            <ListItem
              icon="people-circle-outline"
              iconColor={C.info}
              title={backing.length ? (backing.length === 1 ? t('1 jogador') : t('{n} jogadores', { n: backing.length })) : t('Também bancas outros jogadores?')}
              subtitle={backing.length ? t('Ação em aberto, o que te devem e sessões em direto') : t('Guarda as contas que te enviam e segue-os num só sítio.')}
              onPress={() => router.push('/backing')}
            />
          </ListGroup>
        </Section>

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

/** What a backer's balance is made of, in one line: "a receber 400€ · por pagar 120€ · pago 100€". */
function parts(l: BackerLedger, cur: string): string {
  return [
    l.owed ? t('a receber {amount}', { amount: money(l.owed, cur) }) : '',
    l.unpaid ? t('por pagar {amount}', { amount: money(l.unpaid, cur) }) : '',
    Math.abs(l.paid) >= 0.5 ? (l.paid > 0 ? t('pagaste {amount}', { amount: money(l.paid, cur) }) : t('recebeste {amount}', { amount: money(-l.paid, cur) })) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** One coloured number and a sentence, Splitwise style: where you stand with all your backers. */
function BalanceHeadline({
  net,
  owe,
  owed,
  oweTo,
  owedBy,
  makeup,
  live,
  currency,
}: {
  net: number;
  owe: number;
  owed: number;
  oweTo: number;
  owedBy: number;
  makeup: number;
  live: number;
  currency: string;
}) {
  const square = Math.abs(net) < 0.5;
  const color = square ? C.textDim : net > 0 ? C.warn : C.good;
  const verdict = square ? t('Estás acertado com os backers') : net > 0 ? t('No total, deves aos backers') : t('No total, os backers devem-te');
  // Both directions at once: say who is on each side, so the net isn't a mystery.
  const split =
    owe >= 0.5 && owed >= 0.5
      ? [
          oweTo === 1 ? t('deves {amount} a 1 backer', { amount: money(owe, currency) }) : t('deves {amount} a {n} backers', { amount: money(owe, currency), n: oweTo }),
          owedBy === 1 ? t('1 deve-te {amount}', { amount: money(owed, currency) }) : t('{n} devem-te {amount}', { amount: money(owed, currency), n: owedBy }),
        ].join(' · ')
      : '';
  const extra = [makeup >= 0.5 ? t('makeup {amount}', { amount: money(makeup, currency) }) : '', live ? (live === 1 ? t('1 sessão a decorrer') : t('{n} sessões a decorrer', { n: live })) : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <Card tone="raised" style={{ gap: S.xs, paddingVertical: S.xl }}>
      <T v="label">{verdict}</T>
      {square ? null : (
        <T v="monoXL" color={color} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 40, lineHeight: 46 }}>
          {money(Math.abs(net), currency)}
        </T>
      )}
      {split ? <T v="small">{split}</T> : null}
      {extra ? (
        <T v="small" color={makeup >= 0.5 ? C.warn : undefined}>
          {extra}
        </T>
      ) : null}
    </Card>
  );
}
