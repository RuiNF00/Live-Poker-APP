// One backer: the balance between you, their packages, every session they have
// a piece of, and the payments that settle it.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Avatar } from '@/components/Avatar';
import { BackerSheet, blankPackage, markupLabel, PackageSheet, packageTerms, PaymentSheet } from '@/components/staking/sheets';
import { PieceSheet, SettlementCard } from '@/components/staking/Settlement';
import { balanceLabel, useStaking } from '@/components/staking/use-staking';
import { Amount, Button, Card, Empty, IconButton, ListGroup, ListItem, Pill, Row, Screen, Section, Stat, StatGrid, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { buildStatement, statementUrl } from '@/lib/backing-link';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { money, shortDate } from '@/poker/format';
import { uid, useStore } from '@/store/store';
import type { BackerLedgerRow } from '@/store/staking';
import type { Session, StakePackage } from '@/store/types';
import { C, S } from '@/theme';
import { withPro } from '@/components/ProGate';

function confirm(title: string, body: string, ok: () => void, okLabel = t('Sim')) {
  if (Platform.OS === 'web') ok();
  else Alert.alert(title, body, [{ text: t('Cancelar'), style: 'cancel' }, { text: okLabel, style: 'destructive', onPress: ok }]);
}

function BackerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, backers, packages, payments, saveBacker, deleteBacker, savePackage, deletePackage, savePayment, deletePayment, saveSession, settings } = useStore();
  const { pk, ledgers } = useStaking();
  const [editing, setEditing] = useState(false);
  const [pkg, setPkg] = useState<StakePackage | null>(null);
  const [paying, setPaying] = useState(false);
  const [piece, setPiece] = useState<BackerLedgerRow | null>(null);
  const backer = backers.find((b) => b.id === id);
  const l = backer ? ledgers.get(backer.id) : undefined;
  // Totals are in the deal's currency; each session row in its own.
  const cur = l?.currency || settings.currency;

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
    tap('medium');
    setPiece(null);
  };

  const square = Math.abs(l.balance) < 0.5;
  // Settle the whole balance in one payment, the way Splitwise's "settle up" does.
  const markPaid = () =>
    confirm(
      t('Marcar como pago?'),
      l.balance > 0
        ? t('Pagaste {amount} a {name} e ficam acertados.', { amount: money(l.balance, cur), name: backer.name })
        : t('{name} pagou-te {amount} e ficam acertados.', { amount: money(-l.balance, cur), name: backer.name }),
      () => {
        const now = Date.now();
        savePayment({ id: uid('y_'), backerId: backer.id, amount: Math.round(l.balance * 100) / 100, at: now, note: '', createdAt: now });
        tap('medium');
        // Store-review moment C (design/pedido-avaliacao.md): maybeAskForReview('settled') here once src/lib/review.ts lands.
      },
      t('Marcar como pago'),
    );

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
    // The statement as a link they can open, or save in their own Sweatbook to follow every session.
    // It carries only this backer's own pieces (see lib/backing-link).
    const key = backer.shareKey ?? uid('k');
    const ref = await shareRef().catch(() => '');
    const st = buildStatement({ ...backer, shareKey: key }, settings.nickname || '', cur, sessions, packages, payments);
    const msg = [...lines, '', t('As contas e as sessões em direto: {url}', { url: statementUrl(st, ref) })].join('\n');
    if (Platform.OS === 'web') await Clipboard.setStringAsync(msg);
    else {
      const r = await Share.share({ message: msg });
      if (r.action === Share.dismissedAction) return;
    }
    // Keep a record of when they were sent the statement and what it said.
    saveBacker({ ...backer, shareKey: key, reminders: [...(backer.reminders ?? []), { at: Date.now(), balance: l.balance }].slice(-20) });
    track('link_shared', { channel: 'backer_statement' });
  };

  type Hist = { kind: 'pay'; at: number; p: (typeof pays)[number] } | { kind: 'sent'; at: number; balance: number };
  const history: Hist[] = [
    ...pays.map((p) => ({ kind: 'pay' as const, at: p.at, p })),
    ...(backer.reminders ?? []).map((r) => ({ kind: 'sent' as const, at: r.at, balance: r.balance })),
  ].sort((a, b) => b.at - a.at);

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
          {square ? (
            <Row gap={S.sm} style={{ alignSelf: 'stretch', marginTop: S.xs }}>
              <Button size="md" kind="secondary" style={{ flex: 1 }} icon="share-outline" title={t('Enviar contas')} onPress={shareSummary} />
              <Button size="md" kind="secondary" style={{ flex: 1 }} icon="cash-outline" title={t('Pagamento')} onPress={() => setPaying(true)} />
            </Row>
          ) : (
            // Stacked: "Marcar como pago" (and "Marcar como pagado" in es) doesn't fit half the width of an iPhone.
            <View style={{ alignSelf: 'stretch', gap: S.sm, marginTop: S.xs }}>
              <Button size="md" icon="checkmark-circle-outline" title={t('Marcar como pago')} onPress={markPaid} />
              <Button size="md" kind="secondary" icon="share-outline" title={t('Enviar contas')} onPress={shareSummary} />
            </View>
          )}
          {square ? null : <Button size="sm" kind="ghost" title={t('Pagamento de outro valor')} onPress={() => setPaying(true)} />}
        </Card>

        <Section title={t('Como chegámos aqui')}>
          <SettlementCard l={l} name={backer.name} currency={cur} />
        </Section>

        <StatGrid cols={3}>
          <Stat label={t('Custo')} value={money(l.invested, cur)} />
          <Stat label={t('Resultado')} value={money(l.result, cur)} tone={l.result > 0 ? 'good' : l.result < 0 ? 'bad' : undefined} />
          <Stat label="Makeup" value={money(l.makeup, cur)} tone={l.makeup ? 'warn' : undefined} />
        </StatGrid>

        <Section title={t('Pacotes')} action={t('+ Novo pacote')} onAction={() => setPkg(blankPackage(backer.id))}>
          {mine.length === 0 ? (
            <Card tone="inset" onPress={() => setPkg(blankPackage(backer.id))}>
              <T v="small">{t('Um pacote junta vários torneios com o mesmo acordo: a mesma % e markup, ou um acordo com makeup. Ao registar ação vendida numa sessão, escolhes o pacote.')}</T>
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

        <Section title={t('Sessões')} hint={t('Toca numa sessão para ver as contas passo a passo.')}>
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
                        {r.stake.unpaid ? <Pill label={t('Por pagar {amount}', { amount: money(r.cost, s.currency || cur) })} color={C.warn} /> : null}
                      </Row>
                    }
                    right={s.endedAt ? <Amount value={net} text={money(net, s.currency || cur)} style={{ fontSize: 14 }} /> : undefined}
                    onPress={() => setPiece(r)}
                  />
                );
              })}
            </ListGroup>
          )}
        </Section>

        {history.length > 0 && (
          <Section title={t('Histórico')} hint={pays.length ? t('Toca num pagamento para o apagar.') : undefined}>
            <ListGroup>
              {history.map((h) =>
                h.kind === 'pay' ? (
                  <ListItem
                    key={h.p.id}
                    icon={h.p.amount > 0 ? 'arrow-up-outline' : 'arrow-down-outline'}
                    iconColor={h.p.amount > 0 ? C.warn : C.good}
                    title={h.p.amount > 0 ? t('Pagaste') : t('Recebeste')}
                    subtitle={[shortDate(h.p.at), h.p.note].filter(Boolean).join(' · ')}
                    value={money(Math.abs(h.p.amount), cur)}
                    chevron={false}
                    onPress={() => confirm(t('Apagar pagamento?'), money(Math.abs(h.p.amount), cur), () => deletePayment(h.p.id), t('Apagar'))}
                  />
                ) : (
                  <ListItem
                    key={'r' + h.at}
                    icon="paper-plane-outline"
                    iconColor={C.info}
                    title={t('Contas enviadas')}
                    subtitle={[shortDate(h.at), balanceLabel(h.balance, cur).text].join(' · ')}
                    chevron={false}
                  />
                ),
              )}
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
      <PieceSheet
        row={piece}
        name={backer.name}
        pkgName={pkgName(piece?.stake.packageId)}
        currency={piece?.session.currency || cur}
        onClose={() => setPiece(null)}
        onTogglePaid={togglePaid}
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

export default withPro('staking', 'Staking', BackerScreen);
