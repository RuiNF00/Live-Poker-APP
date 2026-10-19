// One backer: the balance between you, their packages, every session they have
// a piece of, and the payments that settle it.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useRef, useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Avatar } from '@/components/Avatar';
import { ensureBackerPage, pushBackerPage, statementFor } from '@/components/staking/BackerPage';
import { BackerSheet, blankPackage, markupLabel, PackageSheet, packageTerms, PaymentSheet } from '@/components/staking/sheets';
import { PieceSheet, SettlementCard } from '@/components/staking/Settlement';
import { Sheet } from '@/components/BankrollSheets';
import { ManualRatesForm } from '@/components/HomeCurrencyCard';
import { apartLines, balanceLabel, useHasBackers, useStaking } from '@/components/staking/use-staking';
import { Amount, Button, Card, Chip, ChipRow, Empty, IconButton, ListGroup, ListItem, Pill, Row, Screen, Section, Stat, StatGrid, T, tap } from '@/components/ui';
import { t, variant } from '@/i18n';
import { statementUrl } from '@/lib/backing-link';
import { backerPageUrl, queueBackerPageDelete } from '@/lib/backer-page';
import { track } from '@/lib/events';
import { withLang } from '@/lib/link-lang';
import { shareRef } from '@/lib/referrals';
import { isOnline } from '@/lib/online';
import { maybeAskForReview } from '@/lib/review';
import { notice } from '@/lib/notice';
import { money, num, shortDate } from '@/poker/format';
import { inFestivalPackage, offerPackageIds, setLinePaid, unpaidLinesIn, useOffers, type ActionOffer } from '@/store/action-offer';
import { getPlan, planFestival } from '@/store/festival-plan';
import { allFestivals } from '@/store/my-festivals';
import { CURRENCY_INFO, isoOf, symbolOf } from '@/store/currencies';
import { uid, useStore } from '@/store/store';
import { rate } from '@/store/fx-math';
import { carriedTo, closePackage, headlineOf, ledgerYears, offerRatesNow, packageDefaults, unconverted, yearStatement, type BackerLedgerRow } from '@/store/staking';
import { currentTrip } from '@/store/trip-math';
import type { Backer, Session, StakePackage } from '@/store/types';
import { C, S } from '@/theme';
import { ReadOnlyNote, useProReadOnly, withPro } from '@/components/ProGate';

function confirm(title: string, body: string, ok: () => void, okLabel = t('Sim')) {
  if (Platform.OS === 'web') ok();
  else Alert.alert(title, body, [{ text: t('Cancelar'), style: 'cancel' }, { text: okLabel, style: 'destructive', onPress: ok }]);
}

/** A message with OK, and a way there when there is one (Alert.alert does nothing on react-native-web). */
function tell(title: string, body: string, action?: { label: string; ask: string; run: () => void }) {
  if (Platform.OS === 'web') {
    if (!action) window.alert(`${title}\n\n${body}`);
    else if (window.confirm(`${title}\n\n${body}\n\n${action.ask}`)) action.run();
  } else Alert.alert(title, body, action ? [{ text: 'OK', style: 'cancel' }, { text: action.label, onPress: action.run }] : undefined);
}

/** A currency as the backer reads it: its symbol, or its code where the symbol is shared ($, kr, ¥). */
function curName(c: string): string {
  const s = symbolOf(c);
  return ['$', 'kr', '¥'].includes(s) ? (isoOf(c) ?? s) : s;
}

/** Opens the festival package, from an alert that says to go there. */
const openOffer = (o: ActionOffer | undefined) => (o ? { label: t('Abrir o pacote'), ask: t('Abrir o pacote?'), run: () => router.push({ pathname: '/action/[id]', params: { id: o.id } }) } : undefined);

function BackerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, backers, packages, payments, trips, saveBacker, deleteBacker, savePackage, deletePackage, savePayment, deletePayment, saveSession, settings, setSettings } = useStore();
  const { pk, ledgers, fx } = useStaking();
  const offers = useOffers();
  const [editing, setEditing] = useState(false);
  const [pkg, setPkg] = useState<StakePackage | null>(null);
  const [paying, setPaying] = useState(false);
  const [typing, setTyping] = useState(false);
  const [piece, setPiece] = useState<BackerLedgerRow | null>(null);
  const [year, setYear] = useState<number | null>(null);
  // «Enviar contas» one at a time: on one bar of signal the page can take a while, and a second tap would open a second share.
  const sending = useRef(false);
  // After Pro ended: everything shows, and each change goes through "Ver com Pro".
  const { readOnly, gate } = useProReadOnly('staking');
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

  // With the deal square, festival action with no rate leads: never «Acertado» above a debt (Design P2).
  const head = headlineOf(l, cur);
  const bal = balanceLabel(head.balance, head.currency);
  const apart = unconverted(l);
  // Kept with each payment: the rates its festival packages were converted at (Pronto P2-B).
  const ratesNow = () => offerRatesNow(backer.id, cur, offers, (fid) => planFestival(allFestivals(), fid)?.currency, (from, to, at) => rate(fx.table, from, to, at, fx.manual));
  // Currencies the ECB doesn't publish never get a rate with the signal: the player types theirs here (QA P2).
  const typedApart = apart.filter((c) => CURRENCY_INFO[c]?.ecb === false);
  // Festival pieces with no rate, still to pay for: «Marcar como pago» marks them paid (QA P2).
  const apartDue = unpaidLinesIn(offers, backer.id, apart, (fid) => planFestival(allFestivals(), fid), (fid) => getPlan(fid).sessions);
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

  // Nothing to settle in the deal's currency (festival action apart, if any, can't be settled without a rate).
  const square = Math.abs(l.balance) < 0.01;
  // Settle the whole balance in one payment, the way Splitwise's "settle up" does.
  const markPaid = () =>
    confirm(
      t('Marcar como pago?'),
      l.balance > 0
        ? t('Pagaste {amount} a {name} e ficam acertados.', { amount: money(l.balance, cur), name: backer.name })
        : t('{name} pagou-te {amount} e ficam acertados.', { amount: money(-l.balance, cur), name: backer.name }),
      () => {
        const now = Date.now();
        savePayment({ id: uid('y_'), backerId: backer.id, amount: Math.round(l.balance * 100) / 100, at: now, note: '', createdAt: now, fx: ratesNow() });
        tap('medium');
        // Store-review moment C (design/pedido-avaliacao.md): the balance is now "Acertado".
        if (!apart.length) void maybeAskForReview('settled');
      },
      t('Marcar como pago'),
    );

  // Only festival action with no rate is left: the backer paid their pieces, in the festival's currency.
  const settleApart = () => {
    const paidIn = new Map<string, number>();
    for (const x of apartDue) paidIn.set(x.currency, (paidIn.get(x.currency) ?? 0) + x.due);
    const amount = [...paidIn].map(([c, v]) => money(v, c)).join(' + ');
    // A refund for an event not played, or a piece still in a session, can leave something either way.
    const square = l.apart.every((a) => Math.abs(a.balance + (paidIn.get(a.currency) ?? 0)) < 0.01);
    return confirm(
      t('Marcar como pago?'),
      square ? t('{name} pagou-te {amount} e ficam acertados.', { name: backer.name, amount }) : t('{name} pagou-te {amount}.', { name: backer.name, amount }),
      () => {
        for (const x of apartDue) setLinePaid(x.offerId, x.lineId, true);
        tap('medium');
      },
      t('Marcar como pago'),
    );
  };

  const shareSummary = async (withYear = false) => {
    if (sending.current) return;
    // Festival action with no rate yet: the text and the link would show less than the real balance.
    if (apart.length)
      return typedApart.length
        ? tell(t('Falta o câmbio de {list}', { list: apart.map(curName).join(', ') }), t('O BCE não publica {list}. Escreve o teu câmbio e envia outra vez.', { list: typedApart.map(curName).join(', ') }), { label: t('Escrever o câmbio'), ask: t('Escrever o câmbio?'), run: () => setTyping(true) })
        : tell(t('Falta o câmbio de {list}', { list: apart.map(curName).join(', ') }), t('Sem ele, as contas que o backer recebe ficavam incompletas. Com rede, ou com o câmbio escrito no Bankroll, envia outra vez.'));
    sending.current = true;
    try {
      await sendSummary(withYear);
    } finally {
      sending.current = false;
    }
  };
  const sendSummary = async (withYear: boolean) => {
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
      Math.abs(l.balance) < 0.01
        ? t('Estamos acertados.')
        : l.balance > 0
          ? t('Devo-te {amount}.', { amount: money(l.balance, cur) })
          : t('Deves-me {amount}.', { amount: money(-l.balance, cur) }),
      // Sessions counted 1:1 for want of a rate: the backer is told, in the player's voice to them.
      l.missing.length ? t('Contas aproximadas: falta o câmbio de {list}.', { list: l.missing.map(curName).join(', ') }) : '',
    ].filter((x) => x !== '');
    // The statement as a link they can open, or save in their own Sweatbook to follow every session.
    // It carries only this backer's own pieces (see lib/backing-link).
    const key = backer.shareKey ?? uid('k');
    const ref = await shareRef().catch(() => '');
    const data = { sessions, packages, payments, offers, home: settings.currency };
    let next: Backer = { ...backer, shareKey: key };
    let url = '';
    // Their fixed link: sent once, it keeps itself current (BackerPage). The year summary stays a one-off.
    // Known to be offline: straight to the one-off link, without waiting on requests that can't go out.
    if (!withYear && isOnline())
      try {
        const b = await ensureBackerPage(next, saveBacker);
        next = b;
        // Filled before the message goes, so the backer never opens an empty page.
        if (await pushBackerPage(b.page, statementFor(b, settings.nickname || '', l, data))) url = withLang(backerPageUrl(b.page, ref), variant);
        else next = { ...b, page: undefined };
      } catch {
        // No signal: the one-off link works anyway (its numbers ride in the link itself).
      }
    if (!url) url = withLang(statementUrl(statementFor({ ...next, shareKey: key }, settings.nickname || '', l, data, undefined, withYear && yr ? yr : undefined), ref), variant);
    const msg = [...lines, '', t('As contas e as sessões em direto: {url}', { url })].join('\n');
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      notice(t('Texto copiado'));
    }
    else {
      const r = await Share.share({ message: msg });
      if (r.action === Share.dismissedAction) return;
    }
    // Keep a record of when they were sent the statement and what it said.
    saveBacker({ ...next, shareKey: key, reminders: [...(backer.reminders ?? []), { at: Date.now(), balance: l.balance }].slice(-20) });
    track('link_shared', { channel: withYear ? 'backer_year' : 'backer_statement' });
  };

  // Takes the fixed link down for the backer too; the next "Enviar contas" makes a new one.
  const unlink = () =>
    confirm(
      t('Desligar o link de {name}?', { name: backer.name }),
      t('A página deixa de abrir. Se voltares a enviar as contas, vai um link novo.'),
      () => {
        if (backer.page) queueBackerPageDelete(backer.page);
        saveBacker({ ...backer, page: undefined });
      },
      t('Desligar'),
    );

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
          headerRight: () => <IconButton name="create-outline" size={36} label={t('Editar')} onPress={gate(() => setEditing(true))} />,
        }}
      />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        {readOnly ? <ReadOnlyNote feature="staking" body={t('As contas com {name} ficam aqui. Para registar pagamentos ou mudar pacotes, é com o Pro.', { name: backer.name })} /> : null}
        <Card tone="raised" style={{ gap: S.md, alignItems: 'center', paddingVertical: S.xl }}>
          <Avatar name={backer.name} size={56} />
          <T v="monoXL" color={bal.color} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 34, lineHeight: 40 }}>
            {bal.text}
          </T>
          {head.apart ? (
            <T v="small" color={C.warn} style={{ textAlign: 'center' }}>
              {t('Sem câmbio: fica fora do total.')}
            </T>
          ) : null}
          {/* Offline with no rate yet: sessions in another currency are counted 1 to 1, so say it. */}
          {l.missing.length ? (
            <T v="small" color={C.warn} style={{ textAlign: 'center' }}>
              {t('Sem câmbio para {list}: contas aproximadas até haver rede.', { list: l.missing.map(symbolOf).join(', ') })}
            </T>
          ) : null}
          {/* Festival action with no rate: never added in, shown apart in its own currency (the one leading is above). */}
          {apartLines(l).slice(head.apart ? 1 : 0).map((x) => (
            <T key={x} v="small" color={C.warn} style={{ textAlign: 'center' }}>
              {x}
            </T>
          ))}
          {backer.note ? (
            <T v="small" style={{ textAlign: 'center' }} numberOfLines={3}>
              {backer.note}
            </T>
          ) : null}
          {square && !apartDue.length ? (
            // Stacked too: side by side, «Enviar contas» is cut at 320 points and with large text (Design P3).
            <View style={{ alignSelf: 'stretch', gap: S.sm, marginTop: S.xs }}>
              <Button size="md" kind="secondary" icon="share-outline" title={t('Enviar contas')} onPress={() => void shareSummary()} />
              <Button size="md" kind="secondary" icon="cash-outline" title={t('Pagamento')} onPress={gate(() => setPaying(true))} />
            </View>
          ) : (
            // Stacked: "Marcar como pago" (and "Marcar como pagado" in es) doesn't fit half the width of an iPhone.
            <View style={{ alignSelf: 'stretch', gap: S.sm, marginTop: S.xs }}>
              <Button size="md" icon="checkmark-circle-outline" title={t('Marcar como pago')} onPress={gate(square ? settleApart : markPaid)} />
              <Button size="md" kind="secondary" icon="share-outline" title={t('Enviar contas')} onPress={() => void shareSummary()} />
            </View>
          )}
          {square && !apartDue.length ? null : <Button size="sm" kind="ghost" title={t('Pagamento de outro valor')} onPress={gate(() => setPaying(true))} />}
          {typedApart.length ? (
            <T v="small" color={C.accent} onPress={gate(() => setTyping(true))} accessibilityRole="button" style={{ textAlign: 'center' }}>
              {t('O BCE não publica {list}: escreve o teu câmbio ›', { list: typedApart.map(curName).join(', ') })}
            </T>
          ) : null}
          {/* Known before the tap: the statement waits for the rate (Design P3). */}
          {apart.length ? (
            <T v="tiny" color={C.warn} style={{ textAlign: 'center' }}>
              {t('Para enviar as contas, falta o câmbio de {list}.', { list: apart.map(curName).join(', ') })}
            </T>
          ) : null}
          {backer.page ? (
            // Their fixed link: the player sees exactly what the backer sees, and can take it down.
            <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 2 }}>
              <T v="tiny" style={{ textAlign: 'center' }}>
                {t('{name} tem um link fixo que se atualiza sozinho.', { name: backer.name })}
              </T>
              <Row gap={S.xs}>
                <Button size="sm" kind="ghost" title={t('Ver o que {name} vê', { name: backer.name })} onPress={() => void WebBrowser.openBrowserAsync(withLang(backerPageUrl(backer.page!), variant)).catch(() => {})} />
                <Button size="sm" kind="ghost" title={t('Desligar')} onPress={unlink} />
              </Row>
            </View>
          ) : null}
        </Card>

        <Section title={t('Como chegámos aqui')}>
          <SettlementCard l={l} name={backer.name} currency={cur} />
        </Section>

        <StatGrid cols={3}>
          <Stat label={t('Custo')} value={money(l.invested, cur)} />
          <Stat label={t('Resultado')} value={money(l.result, cur)} tone={l.result > 0 ? 'good' : l.result < 0 ? 'bad' : undefined} />
          <Stat label="Makeup" value={money(l.makeup, cur)} tone={l.makeup ? 'warn' : undefined} />
        </StatGrid>

        <Section title={t('Pacotes')} action={t('+ Novo pacote')} onAction={gate(() => setPkg(blankPackage(backer.id, packageDefaults(backer.id, packages))))}>
          {mine.length === 0 ? (
            <Card tone="inset" onPress={gate(() => setPkg(blankPackage(backer.id, packageDefaults(backer.id, packages))))}>
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
                    onPress={gate(() => setPkg(p))}
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
                    p.makeup >= 0.01 ? t('makeup {amount}', { amount: money(p.makeup, cur) }) : '',
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
                    onPress={gate(() => confirm(t('Apagar pagamento?'), money(Math.abs(h.p.amount), cur), () => deletePayment(h.p.id), t('Apagar')))}
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
          // Their festival pieces would keep counting as sold, and their links stay open: taken out there first.
          inFestivalPackage(offers, backer.id)
            ? tell(t('{name} tem ação de festival', { name: backer.name }), t('Para tirar {name}, vai ao pacote do festival: assim o link também muda.', { name: backer.name }), openOffer(offers.find((o) => o.lines.some((x) => x.backerId === backer.id))))
            : confirm(t('Apagar {name}?', { name: backer.name }), t('Os pacotes e pagamentos deste backer também são apagados. As sessões ficam, com a ação vendida sem nome.'), () => {
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
        makeup={pkg && (pk.states.get(pkg.id)?.makeup ?? 0) >= 0.01 ? money(pk.states.get(pkg.id)!.makeup, pk.states.get(pkg.id)!.currency || cur) : null}
        onClose={() => setPkg(null)}
        onSave={(p, carry) => {
          // Reopening a package whose makeup went to a new one: that one goes, or the makeup counts
          // twice. Once it has sessions (or was closed itself, maybe carried on to a «(3)») the makeup
          // is being won back there, so it stays closed.
          const was = packages.find((q) => q.id === p.id);
          const next = was?.closedAt && !p.closedAt ? carriedTo(was, packages) : undefined;
          if (next && ((pk.states.get(next.id)?.sessions ?? 0) > 0 || next.closedAt)) {
            Alert.alert(t('Não dá para reabrir este pacote'), t('O makeup deste pacote já passou para «{name}», que já tem sessões. Continua a ser recuperado lá.', { name: next.name }));
            return;
          }
          if (next) deletePackage(next.id);
          if (carry) {
            const { closed, next } = closePackage(p, pk.states.get(p.id)?.makeup ?? 0, true, uid('p'), undefined, pk.states.get(p.id)?.currency);
            savePackage(closed);
            if (next) savePackage(next);
          } else savePackage(p);
          setPkg(null);
        }}
        onDelete={
          pkg && packages.some((p) => p.id === pkg.id)
            ? () => {
                // A festival package's piece lives in the festival's package (and the backer's link): taken out there.
                if (offerPackageIds(offers).has(pkg.id)) return tell(t('Este pacote é de uma ação de festival'), t('Para tirar {name}, vai ao pacote do festival: assim o link também muda.', { name: backer.name }), openOffer(offers.find((o) => o.lines.some((x) => x.packageId === pkg.id))));
                confirm(t('Apagar pacote?'), t('As sessões ficam vendidas a {name}, fora de pacote.', { name: backer.name }), () => {
                  deletePackage(pkg.id);
                  setPkg(null);
                }, t('Apagar'));
              }
            : undefined
        }
      />
      <PieceSheet
        row={piece}
        name={backer.name}
        pkgName={pkgName(piece?.stake.packageId)}
        currency={piece?.session.currency || cur}
        onClose={() => setPiece(null)}
        onTogglePaid={gate(togglePaid)}
      />
      <Sheet visible={typing} title={t('Câmbio escrito por ti')} onClose={() => setTyping(false)}>
        <ManualRatesForm
          codes={typedApart}
          initial={settings.fxManual ?? {}}
          onSave={(fxManual) => {
            setSettings({ fxManual });
            setTyping(false);
          }}
        />
      </Sheet>
      <PaymentSheet
        backer={paying ? backer : null}
        balance={l.balance}
        currency={cur}
        onClose={() => setPaying(false)}
        onSave={(p) => {
          savePayment({ ...p, fx: ratesNow() ?? p.fx });
          setPaying(false);
          // A payment that squares the balance is moment C too.
          if (Math.abs(l.balance - p.amount) < 0.01 && !apart.length) void maybeAskForReview('settled');
        }}
      />
    </>
  );
}

export default withPro('staking', 'Staking', BackerScreen, useHasBackers);
