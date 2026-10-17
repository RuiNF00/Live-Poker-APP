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
import { Amount, Button, Card, Chip, ChipRow, Empty, IconButton, ListGroup, ListItem, Pill, Row, Screen, Section, Stat, StatGrid, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { buildStatement, statementUrl } from '@/lib/backing-link';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { maybeAskForReview } from '@/lib/review';
import { notice } from '@/lib/notice';
import { money, num, shortDate } from '@/poker/format';
import { uid, useStore } from '@/store/store';
import { rate } from '@/store/fx-math';
import { closePackage, ledgerYears, packageDefaults, yearStatement, type BackerLedgerRow } from '@/store/staking';
import { currentTrip } from '@/store/trip-math';
import type { Session, StakePackage } from '@/store/types';
import { C, S } from '@/theme';
import { withPro } from '@/components/ProGate';

function confirm(title: string, body: string, ok: () => void, okLabel = t('Sim')) {
  if (Platform.OS === 'web') ok();
  else Alert.alert(title, body, [{ text: t('Cancelar'), style: 'cancel' }, { text: okLabel, style: 'destructive', onPress: ok }]);
}

function BackerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, backers, packages, payments, trips, saveBacker, deleteBacker, savePackage, deletePackage, savePayment, deletePayment, saveSession, settings } = useStore();
  const { pk, ledgers, fx } = useStaking();
  const [editing, setEditing] = useState(false);
  const [pkg, setPkg] = useState<StakePackage | null>(null);
  const [paying, setPaying] = useState(false);
  const [piece, setPiece] = useState<BackerLedgerRow | null>(null);
  const [year, setYear] = useState<number | null>(null);
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
  // A package started during a trip is usually for that festival.
  const trip = currentTrip(trips);
  const pkgName = (pid?: string) => packages.find((p) => p.id === pid)?.name;

  // "O ano com {backer}": every package of the year, in the deal's currency.
  const years = ledgerYears(l);
  const yr = years.length ? yearStatement(l, year && years.includes(year) ? year : years[0], packages, pk, (s) => (s.currency && s.currency !== cur ? (rate(fx.table, s.currency, cur, s.startedAt, fx.manual) ?? 1) : 1), (m, c) => m * (rate(fx.table, c, cur, l.rows[0]?.session.startedAt ?? 0, fx.manual) ?? 1)) : null;

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
        // Store-review moment C (design/pedido-avaliacao.md): the balance is now "Acertado".
        void maybeAskForReview('settled');
      },
      t('Marcar como pago'),
    );

  const shareSummary = async (withYear = false) => {
    tap('medium');
    const lines = withYear && yr ? [
      t('{year} com {name}', { year: yr.year, name: backer.name }),
      ...yr.rows.map((p) => `${p.name || t('Fora de pacote')} · ${t('buy-ins {cost} · recebeste {back}', { cost: money(p.cost, cur), back: money(p.prizes, cur) })} → ${money(p.net, cur)}`),
      '',
      t('Resultado do ano: {amount}', { amount: money(yr.net, cur) }),
      yr.makeup ? t('Makeup: {amount}', { amount: money(yr.makeup, cur) }) : '',
    ].filter((x) => x !== '') : [
      t('Staking com {name}', { name: backer.name }),
      ...l.rows
        .filter((r) => r.session.endedAt)
        .slice(0, 12)
        .map((r) => `${shortDate(r.session.startedAt)} · ${r.session.name || t('Sessão')} · ${num(r.stake.share)}% → ${money(r.owed - r.cost, r.session.currency || cur)}`),
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
    const st = buildStatement({ ...backer, shareKey: key }, settings.nickname || '', cur, sessions, packages, payments, undefined, withYear && yr ? yr : undefined, l);
    const msg = [...lines, '', t('As contas e as sessões em direto: {url}', { url: statementUrl(st, ref) })].join('\n');
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      notice(t('Texto copiado'));
    }
    else {
      const r = await Share.share({ message: msg });
      if (r.action === Share.dismissedAction) return;
    }
    // Keep a record of when they were sent the statement and what it said.
    saveBacker({ ...backer, shareKey: key, reminders: [...(backer.reminders ?? []), { at: Date.now(), balance: l.balance }].slice(-20) });
    track('link_shared', { channel: withYear ? 'backer_year' : 'backer_statement' });
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
          {/* Offline with no rate yet: sessions in another currency are counted 1 to 1, so say it. */}
          {l.missing.length ? (
            <T v="small" color={C.warn} style={{ textAlign: 'center' }}>
              {t('Sem câmbio para {list}: contas aproximadas até haver rede.', { list: l.missing.join(', ') })}
            </T>
          ) : null}
          {backer.note ? (
            <T v="small" style={{ textAlign: 'center' }} numberOfLines={3}>
              {backer.note}
            </T>
          ) : null}
          {square ? (
            <Row gap={S.sm} style={{ alignSelf: 'stretch', marginTop: S.xs }}>
              <Button size="md" kind="secondary" style={{ flex: 1 }} icon="share-outline" title={t('Enviar contas')} onPress={() => void shareSummary()} />
              <Button size="md" kind="secondary" style={{ flex: 1 }} icon="cash-outline" title={t('Pagamento')} onPress={() => setPaying(true)} />
            </Row>
          ) : (
            // Stacked: "Marcar como pago" (and "Marcar como pagado" in es) doesn't fit half the width of an iPhone.
            <View style={{ alignSelf: 'stretch', gap: S.sm, marginTop: S.xs }}>
              <Button size="md" icon="checkmark-circle-outline" title={t('Marcar como pago')} onPress={markPaid} />
              <Button size="md" kind="secondary" icon="share-outline" title={t('Enviar contas')} onPress={() => void shareSummary()} />
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

        <Section title={t('Pacotes')} action={t('+ Novo pacote')} onAction={() => setPkg(blankPackage(backer.id, packageDefaults(backer.id, packages)))}>
          {mine.length === 0 ? (
            <Card tone="inset" onPress={() => setPkg(blankPackage(backer.id, packageDefaults(backer.id, packages)))}>
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
                        <T v="body" numberOfLines={2} style={{ flexShrink: 1 }}>
                          {p.name}
                        </T>
                        {p.closedAt ? <Pill label={t('Fechado')} /> : null}
                      </Row>
                    }
                    subtitle={[packageTerms(p), st?.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: st?.sessions ?? 0 })].join(' · ')}
                    right={
                      // A closed package's makeup was forgiven or carried to the next one: only open ones show it.
                      st?.makeup && !p.closedAt ? (
                        // Stacked, so a long package name keeps the width (360 pt, Spanish, larger text).
                        <View style={{ alignItems: 'flex-end' }}>
                          <T v="tiny" color={C.warn}>
                            Makeup
                          </T>
                          <T v="mono" color={C.warn} style={{ fontSize: 14 }}>
                            {money(st.makeup, st.currency || cur)}
                          </T>
                        </View>
                      ) : st && st.sessions - st.live > 0 ? (
                        <Amount value={st.net} text={money(st.net, st.currency || cur)} style={{ fontSize: 14 }} />
                      ) : undefined
                    }
                    onPress={() => setPkg(p)}
                  />
                );
              })}
            </ListGroup>
          )}
        </Section>

        {yr ? (
          <Section title={t('O ano com {name}', { name: backer.name })}>
            {years.length > 1 ? (
              <ChipRow>
                {years.map((y) => (
                  <Chip key={y} label={String(y)} active={y === yr.year} onPress={() => setYear(y)} />
                ))}
              </ChipRow>
            ) : null}
            <ListGroup>
              {yr.rows.map((p) => (
                <ListItem
                  key={p.id ?? 'none'}
                  icon={p.id ? 'layers-outline' : 'ellipse-outline'}
                  iconColor={p.id ? C.accent : C.muted}
                  title={p.name || t('Fora de pacote')}
                  subtitle={[
                    p.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: p.sessions }),
                    t('buy-ins {amount}', { amount: money(p.cost, cur) }),
                    t('prémios {amount}', { amount: money(p.prizes, cur) }),
                    p.makeup >= 0.5 ? t('makeup {amount}', { amount: money(p.makeup, cur) }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={<Amount value={p.net} text={money(p.net, cur)} style={{ fontSize: 14 }} />}
                  chevron={false}
                />
              ))}
            </ListGroup>
            <StatGrid cols={3}>
              <Stat label={t('Buy-ins')} value={money(yr.cost, cur)} />
              <Stat label={t('Prémios')} value={money(yr.prizes, cur)} />
              <Stat label={t('Resultado')} value={money(yr.net, cur)} tone={yr.net > 0 ? 'good' : yr.net < 0 ? 'bad' : undefined} />
            </StatGrid>
            <Button size="md" kind="secondary" icon="share-outline" title={t('Enviar o resumo de {year}', { year: yr.year })} onPress={() => void shareSummary(true)} />
          </Section>
        ) : null}

        <Section title={t('Sessões')} hint={t('Toca numa sessão para ver as contas passo a passo.')}>
          {l.rows.length === 0 ? (
            <Card tone="inset">
              <T v="small">{t('Ainda sem sessões. Na sessão, em Staking, regista a parte vendida a {name}.', { name: backer.name })}</T>
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
                          {[shortDate(s.startedAt), `${num(r.stake.share)}%`, r.stake.markup !== 1 ? markupLabel(r.stake.markup) : '', pkgName(r.stake.packageId) ?? ''].filter(Boolean).join(' · ')}
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
        suggestName={trip ? trip.name || trip.venue : undefined}
        balance={
          square
            ? null
            : l.balance > 0
              ? t('Deves {amount} a {name}.', { amount: money(l.balance, cur), name: backer.name })
              : t('{name} deve-te {amount}.', { amount: money(-l.balance, cur), name: backer.name })
        }
        makeup={pkg && (pk.states.get(pkg.id)?.makeup ?? 0) >= 0.5 ? money(pk.states.get(pkg.id)!.makeup, pk.states.get(pkg.id)!.currency || cur) : null}
        onClose={() => setPkg(null)}
        onSave={(p, carry) => {
          if (carry) {
            const { closed, next } = closePackage(p, pk.states.get(p.id)?.makeup ?? 0, true, uid('p'), undefined, pk.states.get(p.id)?.currency);
            savePackage(closed);
            if (next) savePackage(next);
          } else savePackage(p);
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
          // A payment that squares the balance is moment C too.
          if (Math.abs(l.balance - p.amount) < 0.5) void maybeAskForReview('settled');
        }}
      />
    </>
  );
}

export default withPro('staking', 'Staking', BackerScreen);
