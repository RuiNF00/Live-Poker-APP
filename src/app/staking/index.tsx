// Staking: everyone who has a piece of your action, what you owe each other,
// their makeup, and the live link they can follow your sessions on.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BackerSheet, blankBacker } from '@/components/staking/sheets';
import { balanceLabel, splitMoney, useStaking } from '@/components/staking/use-staking';
import { Button, Card, Empty, ListGroup, ListItem, Pill, Row, Screen, Section, T } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import type { BackerLedger, StakingTotals } from '@/store/staking';
import type { Backer } from '@/store/types';
import { C, S } from '@/theme';
import { withPro } from '@/components/ProGate';

function StakingScreen() {
  const { backers, backing, saveBacker, activeSession } = useStore();
  const { ledgers, totals } = useStaking();
  const [edit, setEdit] = useState<Backer | null>(null);

  const all = [...ledgers.values()];
  // Makeup stays in each deal's currency: "makeup 2 000€ + 5 000$".
  const makeupBy = new Map<string, number>();
  for (const l of all) if (l.makeup >= 0.5) makeupBy.set(l.currency, (makeupBy.get(l.currency) ?? 0) + l.makeup);
  const makeup = [...makeupBy].map(([c, v]) => money(v, c)).join(' + ');
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
            <BalanceHeadline totals={totals} makeup={makeup} live={live} />

            <Section title="Backers" action={t('+ Novo')} onAction={() => setEdit(blankBacker())}>
              <ListGroup>
                {sorted.map((b) => {
                  const l = ledgers.get(b.id);
                  const cur = l?.currency ?? totals.currency;
                  const bal = { ...balanceLabel(l?.balance ?? 0, cur), owe: (l?.balance ?? 0) > 0 };
                  const square = Math.abs(l?.balance ?? 0) < 0.5;
                  const n = l?.rows.length ?? 0;
                  return (
                    <ListItem
                      key={b.id}
                      left={<Avatar name={b.name} />}
                      title={b.name}
                      accessibilityLabel={[b.name, bal.text, n === 1 ? t('1 sessão') : t('{n} sessões', { n }), l ? parts(l, cur) : ''].filter(Boolean).join(', ')}
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

/**
 * What a backer's balance is made of, in one line: "o backer recebe 400€ · ação por pagar 120€".
 * Only when it's more than one thing: a single part is the balance itself, said again.
 */
function parts(l: BackerLedger, cur: string): string {
  const list = [
    l.owed ? t('o backer recebe {amount}', { amount: money(l.owed, cur) }) : '',
    l.unpaid ? t('ação por pagar {amount}', { amount: money(l.unpaid, cur) }) : '',
    Math.abs(l.paid) >= 0.5 ? (l.paid > 0 ? t('pagaste {amount}', { amount: money(l.paid, cur) }) : t('recebeste {amount}', { amount: money(-l.paid, cur) })) : '',
  ].filter(Boolean);
  return list.length > 1 ? list.join(' · ') : '';
}

/** One coloured number and a sentence, Splitwise style: where you stand with all your backers. */
function BalanceHeadline({ totals, makeup, live }: { totals: StakingTotals; makeup: string; live: number }) {
  const { owe, owed, oweTo, owedBy, currency, split } = totals;
  const net = owe - owed;
  // Currencies with no rate between them can't be netted: say each side instead.
  const square = split ? !split.length : Math.abs(net) < 0.5;
  const oweSide = split ? split.some((x) => x.owe >= 0.5) : net > 0;
  const color = square ? C.textDim : oweSide ? C.warn : C.good;
  const verdict = square ? t('Estás acertado com os backers') : oweSide ? t('No total, deves aos backers') : t('No total, os backers devem-te');
  const big = split ? splitMoney(totals, oweSide ? 'owe' : 'owed') : (totals.approx ? '≈ ' : '') + money(Math.abs(net), currency);
  const oweText = splitMoney(totals, 'owe');
  const owedText = splitMoney(totals, 'owed');
  // Both directions at once: say who is on each side, so the net isn't a mystery.
  const split2 =
    oweTo && owedBy
      ? [
          oweTo === 1 ? t('deves {amount} a 1 backer', { amount: oweText }) : t('deves {amount} a {n} backers', { amount: oweText, n: oweTo }),
          owedBy === 1 ? t('1 deve-te {amount}', { amount: owedText }) : t('{n} devem-te {amount}', { amount: owedText, n: owedBy }),
        ].join(' · ')
      : '';
  const extra = [makeup ? t('makeup {amount}', { amount: makeup }) : '', live ? (live === 1 ? t('1 sessão a decorrer') : t('{n} sessões a decorrer', { n: live })) : '']
    .filter(Boolean)
    .join(' · ');
  // VoiceOver reads the card as one sentence, without the "≈" sign.
  const spoken = [verdict, square ? '' : big.replace('≈ ', t('cerca de') + ' '), split2, extra].filter(Boolean).join('. ');
  return (
    <Card tone="raised" style={{ paddingVertical: S.xl }}>
      <View accessible accessibilityLabel={spoken} style={{ gap: S.xs }}>
        <T v="label">{verdict}</T>
        {square ? null : (
          <T v="monoXL" color={color} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 40, lineHeight: 46 }}>
            {big}
          </T>
        )}
        {split2 ? <T v="small">{split2}</T> : null}
        {totals.approx ? <T v="tiny">{t('Em {currency} ao câmbio de hoje. Cada backer fica na moeda das sessões dele.', { currency })}</T> : null}
        {extra ? (
          <T v="small" color={makeup ? C.warn : undefined}>
            {extra}
          </T>
        ) : null}
      </View>
    </Card>
  );
}

export default withPro('staking', 'Staking', StakingScreen);
