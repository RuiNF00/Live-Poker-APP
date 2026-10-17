// One backer: the balance between you, their packages, every session they have
// a piece of, and the payments that settle it.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Avatar } from '@/components/Avatar';
import { BackerSheet, blankPackage, markupLabel, PackageSheet, packageTerms, PaymentSheet } from '@/components/staking/sheets';
import { balanceLabel, useStaking } from '@/components/staking/use-staking';
import { Amount, Button, Card, Empty, IconButton, ListGroup, ListItem, Pill, Row, Screen, Section, Stat, StatGrid, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { money, shortDate } from '@/poker/format';
import { useStore } from '@/store/store';
import type { BackerLedgerRow } from '@/store/staking';
import type { Session, StakePackage } from '@/store/types';
import { C, S } from '@/theme';

function confirm(title: string, body: string, ok: () => void, okLabel = t('Sim')) {
  if (Platform.OS === 'web') ok();
  else Alert.alert(title, body, [{ text: t('Cancelar'), style: 'cancel' }, { text: okLabel, style: 'destructive', onPress: ok }]);
}

export default function BackerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { backers, packages, payments, saveBacker, deleteBacker, savePackage, deletePackage, savePayment, deletePayment, saveSession, settings } = useStore();
  const { pk, ledgers } = useStaking();
  const [editing, setEditing] = useState(false);
  const [pkg, setPkg] = useState<StakePackage | null>(null);
  const [paying, setPaying] = useState(false);
  const backer = backers.find((b) => b.id === id);
  const l = backer ? ledgers.get(backer.id) : undefined;
  const cur = settings.currency;

  if (!backer || !l)
    return (
      <>
        <Stack.Screen options={{ title: 'Backer' }} />
        <Screen contentStyle={{ paddingTop: S.lg }}>
          <Empty title={t('Este backer já não existe')} action={<Button title={t('Voltar')} onPress={() => router.back()} />} />
        </Screen>
      </>
    );

  const bal = balanceLabel(l.balance, cur);
  const mine = packages.filter((p) => p.backerId === backer.id).sort((a, b) => Number(!!a.closedAt) - Number(!!b.closedAt) || b.createdAt - a.createdAt);
  const pays = payments.filter((p) => p.backerId === backer.id).sort((a, b) => b.at - a.at);
  const pkgName = (pid?: string) => packages.find((p) => p.id === pid)?.name;

  const togglePaid = (r: BackerLedgerRow) => {
    const s: Session = r.session;
    const stakes = (s.stakes ?? []).map((x) => (x === r.stake ? { ...x, unpaid: !x.unpaid || undefined } : x));
    saveSession({ ...s, stakes });
  };

  const shareSummary = async () => {
    tap('medium');
    const lines = [
      t('Staking com {name}', { name: backer.name }),
      ...l.rows
        .filter((r) => r.session.endedAt)
        .slice(0, 12)
        .map((r) => `${shortDate(r.session.startedAt)} · ${r.session.name || t('Sessão')} · ${r.stake.share}% → ${money(r.owed - r.cost, cur)}`),
      '',
      t('Resultado: {amount}', { amount: money(l.result, cur) }),
      l.makeup ? t('Makeup: {amount}', { amount: money(l.makeup, cur) }) : '',
      Math.abs(l.balance) < 0.5
        ? t('Estamos acertados.')
        : l.balance > 0
          ? t('Devo-te {amount}.', { amount: money(l.balance, cur) })
          : t('Deves-me {amount}.', { amount: money(-l.balance, cur) }),
    ].filter((x) => x !== '');
    const msg = lines.join('\n');
    if (Platform.OS === 'web') await Clipboard.setStringAsync(msg);
    else await Share.share({ message: msg });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: backer.name,
          headerBackTitle: 'Staking',
          headerRight: () => <IconButton name="create-outline" size={36} label={t('Editar')} onPress={() => setEditing(true)} />,
        }}
      />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <Card tone="raised" style={{ gap: S.md, alignItems: 'center', paddingVertical: S.xl }}>
          <Avatar name={backer.name} size={56} />
          <T v="monoXL" color={bal.color} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 34, lineHeight: 40 }}>
            {bal.text}
          </T>
          {backer.note ? (
            <T v="small" style={{ textAlign: 'center' }} numberOfLines={3}>
              {backer.note}
            </T>
          ) : null}
          <Row gap={S.sm} style={{ alignSelf: 'stretch', marginTop: S.xs }}>
            <Button size="md" kind="secondary" style={{ flex: 1 }} icon="share-outline" title={t('Enviar contas')} onPress={shareSummary} />
            <Button size="md" style={{ flex: 1 }} icon="cash-outline" title={t('Pagamento')} onPress={() => setPaying(true)} />
          </Row>
        </Card>

        <StatGrid cols={3}>
          <Stat label={t('Investido')} value={money(l.invested, cur)} />
          <Stat label={t('Resultado')} value={money(l.result, cur)} tone={l.result > 0 ? 'good' : l.result < 0 ? 'bad' : undefined} />
          <Stat label="Makeup" value={money(l.makeup, cur)} tone={l.makeup ? 'warn' : undefined} />
        </StatGrid>

        <Section title={t('Pacotes')} action={t('+ Novo pacote')} onAction={() => setPkg(blankPackage(backer.id))}>
          {mine.length === 0 ? (
            <Card tone="inset" onPress={() => setPkg(blankPackage(backer.id))}>
              <T v="small">{t('Um pacote junta vários torneios com o mesmo acordo: a mesma % e markup, ou um acordo com makeup. Ao vender ação numa sessão, escolhes o pacote.')}</T>
            </Card>
          ) : (
            <ListGroup>
              {mine.map((p) => {
                const st = pk.states.get(p.id);
                return (
                  <ListItem
                    key={p.id}
                    icon={p.kind === 'makeup' ? 'trending-up-outline' : 'layers-outline'}
                    iconColor={p.closedAt ? C.muted : C.accent}
                    title={
                      <Row gap={S.sm}>
                        <T v="body" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {p.name}
                        </T>
                        {p.closedAt ? <Pill label={t('Fechado')} /> : null}
                      </Row>
                    }
                    subtitle={[packageTerms(p), st?.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: st?.sessions ?? 0 })].join(' · ')}
                    right={
                      st?.makeup ? (
                        <T v="mono" color={C.warn} style={{ fontSize: 14 }}>
                          {t('makeup {amount}', { amount: money(st.makeup, cur) })}
                        </T>
                      ) : st && st.sessions - st.live > 0 ? (
                        <Amount value={st.net} text={money(st.net, cur)} style={{ fontSize: 14 }} />
                      ) : undefined
                    }
                    onPress={() => setPkg(p)}
                  />
                );
              })}
            </ListGroup>
          )}
        </Section>

        <Section title={t('Sessões')} hint={l.rows.some((r) => r.stake.unpaid) ? t('Toca numa sessão por pagar quando o backer pagar a parte dele.') : undefined}>
          {l.rows.length === 0 ? (
            <Card tone="inset">
              <T v="small">{t('Ainda sem sessões. Na sessão, em Staking, vende uma parte a {name}.', { name: backer.name })}</T>
            </Card>
          ) : (
            <ListGroup>
              {l.rows.map((r, i) => {
                const s = r.session;
                const net = r.owed - r.cost;
                return (
                  <ListItem
                    key={s.id + i}
                    title={s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash')}
                    subtitle={
                      <Row gap={6} style={{ flexWrap: 'wrap' }}>
                        <T v="small">
                          {[shortDate(s.startedAt), `${r.stake.share}%`, r.stake.markup !== 1 ? markupLabel(r.stake.markup) : '', pkgName(r.stake.packageId) ?? ''].filter(Boolean).join(' · ')}
                        </T>
                        {!s.endedAt ? <Pill label={t('A decorrer')} color={C.good} icon="ellipse" /> : null}
                        {r.stake.unpaid ? <Pill label={t('Por pagar {amount}', { amount: money(r.cost, cur) })} color={C.warn} /> : null}
                      </Row>
                    }
                    right={s.endedAt ? <Amount value={net} text={money(net, cur)} style={{ fontSize: 14 }} /> : undefined}
                    chevron={false}
                    onPress={
                      r.stake.unpaid
                        ? () => confirm(t('Já pagou?'), t('{name} pagou {amount} por esta parte.', { name: backer.name, amount: money(r.cost, cur) }), () => togglePaid(r), t('Pagou'))
                        : undefined
                    }
                  />
                );
              })}
            </ListGroup>
          )}
        </Section>

        {pays.length > 0 && (
          <Section title={t('Pagamentos')} hint={t('Toca num pagamento para o apagar.')}>
            <ListGroup>
              {pays.map((p) => (
                <ListItem
                  key={p.id}
                  icon={p.amount > 0 ? 'arrow-up-outline' : 'arrow-down-outline'}
                  iconColor={p.amount > 0 ? C.warn : C.good}
                  title={p.amount > 0 ? t('Pagaste') : t('Recebeste')}
                  subtitle={[shortDate(p.at), p.note].filter(Boolean).join(' · ')}
                  value={money(Math.abs(p.amount), cur)}
                  chevron={false}
                  onPress={() => confirm(t('Apagar pagamento?'), money(Math.abs(p.amount), cur), () => deletePayment(p.id), t('Apagar'))}
                />
              ))}
            </ListGroup>
          </Section>
        )}
        <View style={{ height: S.lg }} />
      </Screen>

      <BackerSheet
        backer={editing ? backer : null}
        onClose={() => setEditing(false)}
        onSave={(b) => {
          saveBacker(b);
          setEditing(false);
        }}
        onDelete={() =>
          confirm(t('Apagar {name}?', { name: backer.name }), t('Os pacotes e pagamentos deste backer também são apagados. As sessões ficam, com a ação vendida sem nome.'), () => {
            setEditing(false);
            deleteBacker(backer.id);
            router.back();
          }, t('Apagar'))
        }
      />
      <PackageSheet
        pkg={pkg}
        onClose={() => setPkg(null)}
        onSave={(p) => {
          savePackage(p);
          setPkg(null);
        }}
        onDelete={
          pkg && packages.some((p) => p.id === pkg.id)
            ? () =>
                confirm(t('Apagar pacote?'), t('As sessões ficam vendidas a {name}, fora de pacote.', { name: backer.name }), () => {
                  deletePackage(pkg.id);
                  setPkg(null);
                }, t('Apagar'))
            : undefined
        }
      />
      <PaymentSheet
        backer={paying ? backer : null}
        balance={l.balance}
        currency={cur}
        onClose={() => setPaying(false)}
        onSave={(p) => {
          savePayment(p);
          setPaying(false);
        }}
      />
    </>
  );
}
