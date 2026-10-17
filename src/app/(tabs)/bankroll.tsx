import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { View } from 'react-native';

import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { LineChart } from '@/components/LineChart';
import { BankrollForm, blankTransfer, effectiveRange, FilterForm, PRESETS, rangeLabel, Sheet, TransferForm } from '@/components/BankrollSheets';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { dec } from '@/components/staking/sheets';
import { StakingEntry } from '@/components/staking/StakingEntry';
import { TripsEntry } from '@/components/TripsEntry';
import { SwapsEntry } from '@/components/swaps/SwapsEntry';
import { useSwaps } from '@/store/swaps-store';
import { Insights } from '@/components/Insights';
import { useLocked } from '@/components/ProGate';
import { RulesCard, RulesForm } from '@/components/BankrollRules';
import { YearReviewEntry } from '@/components/YearReviewEntry';
import { WinRateCard } from '@/components/WinRate';
import { HomeCurrencyCard } from '@/components/HomeCurrencyCard';
import { Button, Card, Chip, ChipRow, confirmAction, Empty, IconButton, ListGroup, ListItem, Row, Screen, Section, Segmented, Stat, StatGrid, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { chips, duration, money, shortDate } from '@/poker/format';
import {
  activeFilters,
  applyFilter,
  balanceOf,
  bankrollOf,
  formatOf,
  inRange,
  ledger,
  sameScope,
  scopeCurrency,
  scopeIds,
  scopeOptions,
  sessionsIn,
  stakeKey,
  stakeLabel,
  stakeOptions,
  transfersIn,
  type DateRange,
  type RangePreset,
  type Scope,
  type SessionFilter,
} from '@/store/bankroll-math';
import { insights, MIND_IDS, type MindId } from '@/store/insights-math';
import { bestWeekday, dailyResults, drawdown, lastResults, verdict } from '@/store/results-math';
import { breakdown, curve, owedToBackers, playedMs, profit, totals } from '@/store/session-math';
import { isBagged } from '@/store/multi-day';
import { uid, useStore } from '@/store/store';
import { cashDone, winRate } from '@/store/winrate-math';
import { withdrawable } from '@/store/moveup-math';
import { defaultMonth, monthName, monthRecap } from '@/store/month-recap';
import type { Bankroll, Session, Transfer } from '@/store/types';
import { C, S } from '@/theme';

/** Amounts on this tab, or ••• when the player hid them (at the table). */
const Hidden = createContext(false);
function useFmt() {
  const hidden = useContext(Hidden);
  return (n: number, currency: string) => (hidden ? '•••' : money(n, currency));
}

export default function BankrollScreen() {
  const { settings: st0 } = useStore();
  return (
    <Hidden.Provider value={!!st0.hideAmounts}>
      <BankrollTab />
    </Hidden.Provider>
  );
}

function BankrollTab() {
  const fmt = useFmt();
  const { sessions, transfers, bankrolls, defaultBankroll, saveSession, deleteSession, saveBankroll, deleteBankroll, saveTransfer, deleteTransfer, settings, setSettings } = useStore();
  const { isPro, paywall } = usePro();
  const insightsLocked = useLocked('insights');
  const [scopePick, setScope] = useState<Scope>({ bankrollId: defaultBankroll.id });
  const [game, setGame] = useState<SessionFilter['game']>('all');
  const [format, setFormat] = useState<SessionFilter['format']>('all');
  const [preset, setPreset] = useState<RangePreset>('all');
  const [custom, setCustom] = useState<DateRange>({});
  const [stakes, setStakes] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const locked = !isPro && !FREE.bankrollFilters;

  // A deleted bankroll falls back to the default one.
  const scope = useMemo<Scope>(() => (scopeIds(scopePick, bankrolls).size ? scopePick : { bankrollId: defaultBankroll.id }), [scopePick, bankrolls, defaultBankroll.id]);
  const cur = scopeCurrency(scope, bankrolls) ?? defaultBankroll.currency;
  const inScope = useMemo(() => scopeIds(scope, bankrolls), [scope, bankrolls]);
  const scoped = useMemo(() => sessionsIn(scope, sessions, bankrolls), [scope, sessions, bankrolls]);
  const scopedTx = useMemo(() => transfersIn(scope, transfers, bankrolls), [scope, transfers, bankrolls]);
  const filter = useMemo<SessionFilter>(() => ({ game, format, stakes, range: effectiveRange(preset, custom) }), [game, format, stakes, preset, custom]);
  const range = filter.range;
  const list = useMemo(() => applyFilter(scoped, filter), [scoped, filter]);
  const bal = balanceOf(scope, sessions, transfers, bankrolls);
  const tot = totals(list, cur);
  const wr = useMemo(() => winRate(cashDone(list, cur)), [list, cur]);
  const lastMonth = useMemo(() => {
    const k = defaultMonth(list);
    return k ? monthRecap(list, k, cur) : null;
  }, [list, cur]);
  const verdictNow = verdict(list, cur, (n) => fmt(n, cur));
  const pts = curve(list, cur).map((p) => p.v);
  const dd = drawdown(pts);
  const last5 = lastResults(list, 5);
  const first = list.filter((s) => s.endedAt).reduce((a, s) => Math.min(a, s.startedAt), Infinity);
  const hidden = !!settings.hideAmounts;
  const onlyResults = game !== 'all' || format !== 'all' || stakes.length > 0;
  const history = ledger(list, onlyResults ? [] : scopedTx.filter((x) => inRange(x.at, range)));
  const nFilters = activeFilters(filter);
  const scopeBankrolls = bankrolls.filter((b) => inScope.has(b.id));
  const single = 'bankrollId' in scope ? bankrolls.find((b) => b.id === scope.bankrollId) : undefined;
  const scopeName = single?.name ?? t('Todas {currency}', { currency: cur });
  const pct = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(0)}%`;
  const signedMoney = (n: number) => (hidden ? '•••' : (n > 0 ? '+' : '') + fmt(n, cur));
  const pastBankroll = single ?? scopeBankrolls[0] ?? defaultBankroll;
  // What each bankroll's own rules let come out (a new withdrawal only).
  const keepFor = (id: string) => {
    const b = bankrolls.find((x) => x.id === id);
    if (!b?.rules) return null;
    return withdrawable(balanceOf({ bankrollId: id }, sessions, transfers, bankrolls).balance, sessionsIn({ bankrollId: id }, sessions, bankrolls), b.rules);
  };
  const withdraw = (amount = 0) => setSheet({ type: 'transfer', x: { ...blankTransfer(pastBankroll.id, 'withdrawal'), amount }, isNew: true });

  const newBankroll = () => (!isPro && FREE.bankrolls !== null && bankrolls.length >= FREE.bankrolls ? paywall('stats') : setSheet({ type: 'bankroll' }));
  const openFilters = () => (locked ? paywall('stats') : setSheet({ type: 'filters' }));
  const clearFilters = () => {
    setGame('all');
    setFormat('all');
    setPreset('all');
    setCustom({});
    setStakes([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen
        title="Bankroll"
        right={
          <>
            <IconButton name={settings.hideAmounts ? 'eye-off-outline' : 'eye-outline'} label={settings.hideAmounts ? t('Mostrar valores') : t('Esconder valores')} onPress={() => setSettings({ hideAmounts: !settings.hideAmounts })} />
            <IconButton name="add" label={t('Sessão passada')} onPress={() => setSheet({ type: 'session', s: 'new' })} />
          </>
        }
        contentStyle={{ gap: S.lg }}>
        <HomeCurrencyCard hidden={!!settings.hideAmounts} />
        <ChipRow>
          {scopeOptions(bankrolls).map((o) => (
            <Chip key={'bankrollId' in o.scope ? o.scope.bankrollId : 'all' + o.currency} label={o.label} icon={'currency' in o.scope ? 'albums-outline' : undefined} active={sameScope(o.scope, scope)} onPress={() => setScope(o.scope)} />
          ))}
          <Chip label={t('Nova')} icon={!isPro && FREE.bankrolls !== null && bankrolls.length >= FREE.bankrolls ? 'lock-closed' : 'add'} onPress={newBankroll} />
        </ChipRow>

        <Card tone="raised" style={{ gap: S.sm }}>
          <Row>
            <T v="label" style={{ flex: 1 }} numberOfLines={1}>
              {t('Saldo · {name}', { name: scopeName })}
            </T>
            {single ? <IconButton name="ellipsis-horizontal" size={36} label={t('Gerir bankroll')} onPress={() => setSheet({ type: 'bankroll', b: single })} /> : null}
          </Row>
          <T v="monoXL" color={bal.balance < 0 ? C.bad : C.text} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(bal.balance, cur)}
          </T>
          <T v="small" numberOfLines={2}>
            {[
              t('Resultado {amount}', { amount: signedMoney(bal.results) }),
              bal.deposits ? t('Depósitos {amount}', { amount: fmt(bal.deposits, cur) }) : '',
              bal.withdrawals ? t('Levantamentos {amount}', { amount: fmt(bal.withdrawals, cur) }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
          <Row gap={S.sm} style={{ marginTop: S.xs }}>
            <Button style={{ flex: 1 }} size="sm" kind="secondary" icon="arrow-down" title={t('Depositar')} onPress={() => setSheet({ type: 'transfer', x: blankTransfer(pastBankroll.id, 'deposit'), isNew: true })} />
            <Button style={{ flex: 1 }} size="sm" kind="secondary" icon="arrow-up" title={t('Levantar')} onPress={() => withdraw()} />
          </Row>
        </Card>

        {single ? <RulesCard bankroll={single} sessions={scoped} balance={bal.balance} hidden={!!settings.hideAmounts} onEdit={() => setSheet({ type: 'rules', b: single })} onMoveUp={() => router.push({ pathname: '/moveup', params: { bankroll: single.id } })} onWithdraw={withdraw} /> : null}

        <MoreTools />

        {/* Filters only once there is something to filter. */}
        {scoped.some((x) => x.endedAt) || nFilters ? (
          <View style={{ gap: S.sm }}>
            <Segmented
              options={[
                { key: 'all', label: t('Tudo') },
                { key: 'mtt', label: t('Torneios') },
                { key: 'cash', label: 'Cash' },
              ]}
              value={game}
              onChange={setGame}
            />
            <Segmented
              size="sm"
              options={[
                { key: 'all', label: t('Live e online') },
                { key: 'live', label: 'Live' },
                { key: 'online', label: 'Online' },
              ]}
              value={format}
              onChange={setFormat}
            />
            <ChipRow>
              {nFilters ? <Chip icon="close" label={t('Limpar')} onPress={clearFilters} /> : null}
              <Chip icon={locked ? 'lock-closed' : 'layers-outline'} label={stakes.length ? t('Stakes · {n}', { n: stakes.length }) : t('Todas as stakes')} active={stakes.length > 0} onPress={openFilters} />
              {PRESETS.map((o) => (
                <Chip
                  key={o.key}
                  label={o.key === 'custom' && preset === 'custom' ? rangeLabel(preset, custom) : o.key === 'all' ? t('Tudo') : o.label}
                  icon={o.key !== 'all' && locked ? 'lock-closed' : o.key === 'custom' ? 'calendar-outline' : undefined}
                  active={preset === o.key}
                  onPress={() => (o.key === 'all' ? setPreset('all') : locked ? paywall('stats') : o.key === 'custom' ? setSheet({ type: 'filters' }) : setPreset(o.key))}
                />
              ))}
            </ChipRow>
          </View>
        ) : null}

        <YearReviewEntry />

        {tot.sessions === 0 ? (
          nFilters ? (
            <Empty icon="funnel-outline" title={t('Nada com estes filtros')} body={t('Nenhuma sessão terminada encaixa no que escolheste.')} action={<Button title={t('Limpar filtros')} kind="secondary" size="md" onPress={clearFilters} />} />
          ) : (
            <Empty
              icon="stats-chart"
              title={t('Ainda sem sessões')}
              body={t('Termina uma sessão ao vivo ou junta uma que já jogaste. O lucro, o €/hora e o ROI aparecem aqui.')}
              action={
                <View style={{ gap: S.sm, alignSelf: 'stretch' }}>
                  <Button title={t('Juntar sessão passada')} icon="add" kind="secondary" size="md" onPress={() => setSheet({ type: 'session', s: 'new' })} />
                  <Button title={t('Importar de outra app')} icon="download-outline" kind="ghost" size="md" onPress={() => router.push('/import')} />
                </View>
              }
            />
          )
        ) : (
          <>
            <Card style={{ gap: S.sm, paddingBottom: S.md }}>
              <Row>
                <T v="label" style={{ flex: 1 }} numberOfLines={1}>
                  {t('Resultado de póquer') + ' · ' + (preset === 'all' ? t('Tudo') : rangeLabel(preset, custom)).toLowerCase()}
                </T>
                <Dots results={last5} />
              </Row>
              <T v="monoL" color={tot.profit >= 0 ? C.good : C.bad} numberOfLines={1} adjustsFontSizeToFit>
                {hidden ? '•••' : signedMoney(tot.profit)}
              </T>
              <T v={verdictNow.ready ? 'body' : 'small'} color={verdictNow.tone === 'good' ? C.good : verdictNow.tone === 'bad' ? C.bad : verdictNow.ready ? C.text : C.muted}>
                {verdictNow.text}
              </T>
              <T v="small">
                {[
                  tot.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: tot.sessions }),
                  t('{h} h a jogar', { h: tot.hours.toLocaleString(locale, { maximumFractionDigits: 1 }) }),
                  tot.hours >= 0.25 ? t('{amount}/h', { amount: fmt(Math.round(tot.hourly), cur) }) : '',
                  first ? t('desde {date}', { date: shortDate(first) }) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
              <View style={{ marginTop: S.sm, marginHorizontal: -S.xs }}>
                <LineChart
                  values={pts}
                  height={120}
                  peaks={dd.peaks}
                  label={t('Gráfico do resultado acumulado: {now} em {n} sessões, máximo {max}.', { now: signedMoney(pts[pts.length - 1] ?? 0), n: tot.sessions, max: signedMoney(Math.max(0, ...pts)) })}
                />
              </View>
              <Row gap={S.sm}>
                <Mini label={t('Pico')} value={fmt(dd.peak, cur)} />
                <Mini label={t('Maior queda')} value={dd.max ? '−' + fmt(dd.max, cur) : '—'} color={dd.max ? C.bad : undefined} />
                <Mini label={t('Abaixo do pico')} value={dd.current ? '−' + fmt(dd.current, cur) : t('No pico')} color={dd.current ? C.bad : C.good} />
              </Row>
              <T v="tiny">{t('Pico: o teu melhor resultado acumulado. Maior queda: o máximo que já desceste a partir de um pico.')}</T>
            </Card>
            <StatGrid cols={2}>
              <Stat label={t('Por hora')} sub={t('Lucro ÷ horas à mesa')} value={tot.hours >= 0.25 ? fmt(Math.round(tot.hourly), cur) : '—'} tone={tot.hourly > 0 ? 'good' : tot.hourly < 0 ? 'bad' : undefined} />
              {tot.roi !== null ? <Stat label="ROI" sub={t('Lucro por cada {currency} pago em torneios', { currency: cur })} value={pct(tot.roi)} tone={tot.roi > 0 ? 'good' : tot.roi < 0 ? 'bad' : undefined} /> : null}
              {tot.itm !== null ? <Stat label="ITM" sub={t('Torneios com prémio')} value={`${tot.itm.toFixed(0)}%`} /> : null}
              <Stat label={t('Investido')} sub={t('O teu dinheiro em jogo')} value={fmt(tot.invested, cur)} />
              {tot.tips ? <Stat label={t('Gorjetas')} sub={t('Já descontadas')} value={fmt(tot.tips, cur)} /> : null}
              {tot.handsPerHour !== null ? <Stat label={t('Mãos por hora')} sub={t('Onde as contaste')} value={Math.round(tot.handsPerHour).toLocaleString(locale)} /> : null}
              <Stat label={t('Melhor')} sub={t('Melhor sessão')} value={fmt(tot.best, cur)} tone="good" />
              <Stat label={t('Pior')} sub={t('Pior sessão')} value={fmt(tot.worst, cur)} tone={tot.worst < 0 ? 'bad' : undefined} />
            </StatGrid>
            {wr ? <WinRateCard w={wr} cur={cur} hidden={hidden} onPress={() => router.push({ pathname: '/winrate', params: { currency: cur } })} /> : null}
            <Calendar list={list} cur={cur} />
            <Insights list={list} cur={cur} hidden={!!settings.hideAmounts} />
            <Breakdowns list={list} cur={cur} />
            {!isPro ? (
              <Card tone="accent" onPress={() => paywall('stats')} style={{ gap: S.sm }} accessibilityLabel={t('Experimentar Pro')}>
                <Row>
                  <Ionicons name="sparkles" size={18} color={C.accent} />
                  <T v="h3" style={{ flex: 1 }}>
                    {t('Onde é que ganhas mais?')}
                  </T>
                </Row>
                <T v="small">{t('Com Pro vês todas as salas, jogos e stakes, filtras por datas e a calculadora de variância usa os teus números.')}</T>
                <T v="h3" color={C.accent}>
                  {t('Experimentar Pro')} ›
                </T>
              </Card>
            ) : null}
            <ListGroup>
              {tot.itm !== null ? <ListItem icon="trophy-outline" iconColor={C.accent} title={t('Torneios')} subtitle={t('ROI por buy-in, festival e jogo, e o teu currículo')} onPress={() => router.push('/tournament-stats')} /> : null}
              {lastMonth?.sessions ? (
                <ListItem
                  icon="calendar-outline"
                  iconColor={C.accent}
                  title={t('Resumo do mês')}
                  subtitle={t('{month}: {amount} em {h} h', { month: monthName(lastMonth.key), amount: signedMoney(lastMonth.profit), h: Math.round(lastMonth.hours) })}
                  onPress={() => router.push({ pathname: '/month', params: { m: lastMonth.key } })}
                />
              ) : null}
              {tot.sessions && list.some((x) => x.kind === 'cash') ? (
                <ListItem
                  icon="layers-outline"
                  iconColor={C.accent}
                  title={t('Posso subir de stake?')}
                  subtitle={t('Buy-ins para a tua stake e para a de cima')}
                  onPress={() => router.push({ pathname: '/moveup', params: { bankroll: pastBankroll.id } })}
                />
              ) : null}
              <ListItem
                icon="trending-down"
                iconColor={C.bad}
                title={t('Downswings')}
                subtitle={dd.max ? t('Agora: {now} · maior: −{max}', { now: dd.current ? '−' + fmt(dd.current, cur) : t('no pico'), max: fmt(dd.max, cur) }) : t('A tua maior queda e se é normal')}
                onPress={() => router.push({ pathname: '/downswing', params: { currency: cur } })}
              />
              <ListItem
                icon="pulse-outline"
                iconColor={C.accent}
                title={t('Diário mental')}
                subtitle={(() => {
                  const n = list.filter((x) => x.mind).length;
                  const top = !insightsLocked && n ? insights(list, (v) => (hidden ? '•••' : fmt(Math.round(v), cur))).find((x) => MIND_IDS.includes(x.id as MindId)) : undefined;
                  return top ? top.title : n ? t('{n} check-ins · só tu vês', { n }) : t('Sono, foco e tilt: o que mexem no teu resultado');
                })()}
                onPress={() => router.push({ pathname: '/mind', params: { currency: cur } })}
              />
              <ListItem
                icon="stats-chart-outline"
                iconColor={C.info}
                title={t('Calculadora de variância')}
                subtitle={t('Quanto podes ganhar ou perder nas próximas horas ou torneios')}
                onPress={() => router.push({ pathname: '/variance', params: { currency: cur } })}
              />
            </ListGroup>
          </>
        )}
        {history.length ? (
          <Section title={t('Histórico')}>
            <ListGroup>
              {history.map((e) =>
                'session' in e ? (
                  <SessionRow
                    key={e.session.id}
                    s={e.session}
                    bankroll={single ? undefined : bankrollOf(e.session, bankrolls)?.name}
                    onDelete={() => confirmAction(t('Apagar esta sessão?'), e.session.name || '', t('Apagar'), () => deleteSession(e.session.id))}
                    onEdit={() => setSheet({ type: 'session', s: e.session })}
                  />
                ) : (
                  <TransferRow
                    key={e.transfer.id}
                    x={e.transfer}
                    bankroll={single ? undefined : bankrolls.find((b) => b.id === e.transfer.bankrollId)?.name}
                    onPress={() => setSheet({ type: 'transfer', x: e.transfer, isNew: false })}
                  />
                ),
              )}
            </ListGroup>
          </Section>
        ) : null}
      </Screen>

      <Sheet visible={sheet?.type === 'session'} title={sheet?.type === 'session' && sheet.s !== 'new' ? t('Editar sessão') : t('Sessão passada')} onClose={() => setSheet(null)}>
        {sheet?.type === 'session' ? (
          <SessionForm
            key={sheet.s === 'new' ? 'new' : sheet.s.id}
            past
            bankrolls={bankrolls}
            initial={sheet.s === 'new' ? { ...blankSession('mtt', pastBankroll.currency, settings.defaultTableSize), bankrollId: pastBankroll.id } : sheet.s}
            recentNames={[...new Set(sessions.map((s) => s.name).filter(Boolean))].slice(0, 8)}
            recentVenues={[...new Set(sessions.map((s) => s.venue).filter(Boolean))].slice(0, 8)}
            submitLabel={t('Guardar sessão')}
            onSubmit={(s) => {
              // A new past session always gets a fresh id; an edit keeps its own.
              saveSession(sheet.s === 'new' ? { ...s, id: uid('s_') } : s);
              setSheet(null);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet visible={sheet?.type === 'transfer'} title={sheet?.type === 'transfer' && !sheet.isNew ? (sheet.x.kind === 'deposit' ? t('Depósito') : t('Levantamento')) : sheet?.type === 'transfer' && sheet.x.kind === 'withdrawal' ? t('Levantar') : t('Depositar')} onClose={() => setSheet(null)}>
        {sheet?.type === 'transfer' ? (
          <TransferForm
            key={sheet.x.id}
            initial={sheet.x}
            // Money moves within one currency: the scope's bankrolls, or the transfer's own.
            bankrolls={bankrolls.filter((b) => b.currency === (bankrolls.find((r) => r.id === sheet.x.bankrollId)?.currency ?? cur))}
            keep={sheet.isNew ? keepFor : undefined}
            fmt={fmt}
            onSave={(x) => {
              saveTransfer(x);
              setSheet(null);
            }}
            onDelete={
              sheet.isNew
                ? undefined
                : () =>
                    confirmAction(t('Apagar este movimento?'), fmt(sheet.x.amount, cur), t('Apagar'), () => {
                      deleteTransfer(sheet.x.id);
                      setSheet(null);
                    })
            }
          />
        ) : null}
      </Sheet>

      <Sheet visible={sheet?.type === 'bankroll'} title={sheet?.type === 'bankroll' && sheet.b ? sheet.b.name : t('Nova bankroll')} onClose={() => setSheet(null)}>
        {sheet?.type === 'bankroll' ? (
          <BankrollEditor
            b={sheet.b}
            defaultCurrency={cur}
            onDone={(id) => {
              setSheet(null);
              if (id) setScope({ bankrollId: id });
            }}
            saveBankroll={saveBankroll}
            deleteBankroll={deleteBankroll}
            saveTransfer={saveTransfer}
          />
        ) : null}
      </Sheet>

      <Sheet visible={sheet?.type === 'rules'} title={t('Regras de bankroll')} onClose={() => setSheet(null)}>
        {sheet?.type === 'rules' ? (
          <RulesForm
            bankroll={sheet.b}
            balance={bal.balance}
            onSave={(rules) => {
              saveBankroll({ ...sheet.b, rules });
              setSheet(null);
            }}
            onRemove={
              sheet.b.rules
                ? () => {
                    saveBankroll({ ...sheet.b, rules: undefined });
                    setSheet(null);
                  }
                : undefined
            }
          />
        ) : null}
      </Sheet>

      <Sheet visible={sheet?.type === 'filters'} title={t('Filtros')} onClose={() => setSheet(null)}>
        <FilterForm
          preset={preset}
          custom={custom}
          stakes={stakes}
          options={stakeOptions(scoped, cur)}
          onApply={(p, c, st) => {
            setPreset(p);
            setCustom(c);
            setStakes(st);
            setSheet(null);
          }}
        />
      </Sheet>
    </View>
  );
}

type SheetState =
  | null
  | { type: 'session'; s: Session | 'new' }
  | { type: 'transfer'; x: Transfer; isNew: boolean }
  | { type: 'bankroll'; b?: Bankroll }
  | { type: 'filters' }
  | { type: 'rules'; b: Bankroll };

function BankrollEditor({
  b,
  defaultCurrency,
  onDone,
  saveBankroll,
  deleteBankroll,
  saveTransfer,
}: {
  b?: Bankroll;
  defaultCurrency: string;
  onDone: (scopeTo?: string) => void;
  saveBankroll: (b: Bankroll) => void;
  deleteBankroll: (id: string) => boolean;
  saveTransfer: (x: Transfer) => void;
}) {
  const { bankrolls, sessions, transfers } = useStore();
  let canDelete = false;
  let hint = '';
  if (b) {
    const to = bankrolls.find((r) => r.id !== b.id && r.currency === b.currency);
    const owned = sessions.some((s) => bankrollOf(s, bankrolls)?.id === b.id) || transfers.some((x) => x.bankrollId === b.id);
    if (bankrolls.length < 2) hint = t('É a tua única bankroll.');
    else if (to) {
      canDelete = true;
      hint = owned ? t('As sessões e os movimentos passam para {name}.', { name: to.name }) : '';
    } else if (owned) hint = t('Tem sessões em {currency} e não há outra bankroll em {currency} para as receber.', { currency: b.currency });
    else canDelete = true;
  }
  return (
    <BankrollForm
      initial={b}
      isNew={!b}
      defaultCurrency={defaultCurrency}
      onSave={(nb, start) => {
        saveBankroll(nb);
        if (!b && start > 0) saveTransfer({ ...blankTransfer(nb.id, 'deposit'), amount: start, at: nb.createdAt, note: t('Saldo inicial') });
        onDone(b ? undefined : nb.id);
      }}
      onDelete={
        b && canDelete
          ? () =>
              confirmAction(t('Apagar {name}?', { name: b.name }), hint, t('Apagar'), () => {
                if (deleteBankroll(b.id)) onDone();
              })
          : undefined
      }
      deleteHint={hint}
    />
  );
}

function TransferRow({ x, bankroll, onPress }: { x: Transfer; bankroll?: string; onPress: () => void }) {
  const fmt = useFmt();
  const dep = x.kind === 'deposit';
  const { bankrolls } = useStore();
  const cur = bankrolls.find((b) => b.id === x.bankrollId)?.currency ?? '€';
  return (
    <ListItem
      icon={dep ? 'arrow-down' : 'arrow-up'}
      iconColor={dep ? C.info : C.warn}
      title={dep ? t('Depósito') : t('Levantamento')}
      subtitle={[shortDate(x.at), bankroll, x.note].filter(Boolean).join(' · ')}
      right={
        <T v="mono" color={C.textDim}>
          {(dep ? '+' : '−') + fmt(Math.abs(x.amount), cur)}
        </T>
      }
      chevron={false}
      onPress={onPress}
    />
  );
}

/** Last sessions as green / red dots, oldest on the left. */
function Dots({ results }: { results: number[] }) {
  if (results.length < 2) return null;
  return (
    <Row gap={4} style={{ alignItems: 'center' }}>
      <T v="tiny">{t('Últimas {n}', { n: results.length })}</T>
      {results.map((r, i) => (
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r > 0 ? C.good : r < 0 ? C.bad : C.muted }} />
      ))}
    </Row>
  );
}

const WEEKS = 15;
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Signature view: the last 15 weeks, one square per day, coloured by the day's result. */
function Calendar({ list, cur }: { list: Session[]; cur: string }) {
  const fmt = useFmt();
  const days = dailyResults(list);
  const best = bestWeekday(list);
  if (!days.size) return null;
  const max = Math.max(1, ...[...days.values()].map(Math.abs));
  // Columns are weeks (Monday first), the last one holds today.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - mondayOffset - (WEEKS - 1) * 7);
  const cols = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      return { ts: day.getTime(), future: day.getTime() > today.getTime(), r: days.get(day.getTime()) };
    }),
  );
  const shown = cols.flat().filter((c) => c.r !== undefined).length;
  return (
    <Section title={t('Calendário')} hint={t('Cada quadrado é um dia: verde ganhaste, vermelho perdeste. Mais forte, mais dinheiro.')}>
      <Card style={{ gap: S.md }}>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {cols.map((col, w) => (
            <View key={w} style={{ flex: 1, gap: 3 }}>
              {col.map((c) => (
                <View
                  key={c.ts}
                  style={{
                    aspectRatio: 1,
                    borderRadius: 3,
                    backgroundColor: c.r === undefined ? (c.future ? 'transparent' : C.surface3) : c.r >= 0 ? C.good : C.bad,
                    opacity: c.r === undefined ? 1 : 0.35 + 0.65 * Math.min(1, Math.abs(c.r) / max),
                  }}
                />
              ))}
            </View>
          ))}
        </View>
        <T v="small">
          {best
            ? t('O teu melhor dia é {day}: {amount} em {n} sessões.', { day: t(WEEKDAYS[best.day]), amount: fmt(Math.round(best.profit), cur), n: best.sessions })
            : shown
              ? t('{n} dias jogados nas últimas 15 semanas.', { n: shown })
              : t('Sem sessões nas últimas 15 semanas.')}
        </T>
      </Card>
    </Section>
  );
}

const pctOf = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(0)}%`;

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="tiny" numberOfLines={1}>
        {label}
      </T>
      <T v="mono" color={color ?? C.text} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, lineHeight: 20 }}>
        {value}
      </T>
    </View>
  );
}

function Breakdowns({ list, cur }: { list: Session[]; cur: string }) {
  const fmt = useFmt();
  const { isPro, paywall } = usePro();
  const [by, setBy] = useState<'venue' | 'name' | 'stakes'>('venue');
  const rows = breakdown(list, by === 'stakes' ? (s) => stakeLabel(stakeKey(s), cur) : by, cur);
  if (!list.some((s) => s.endedAt)) return null;
  // Free plan sees the best row; the rest is a Pro reason.
  const shown = isPro ? rows : rows.slice(0, 1);
  const max = Math.max(1, ...rows.map((b) => Math.abs(b.profit)));
  return (
    <Section title={t('Onde ganhas')}>
      <Card style={{ gap: S.md }}>
        <Segmented
          size="sm"
          options={[
            { key: 'venue', label: t('Salas') },
            { key: 'name', label: t('Jogos') },
            { key: 'stakes', label: 'Stakes' },
          ]}
          value={by}
          onChange={setBy}
        />
        {rows.length === 0 ? (
          <T v="small">{by === 'venue' ? t('Dá um nome à sala nas sessões para ver aqui.') : t('Dá um nome ao jogo nas sessões para ver aqui.')}</T>
        ) : (
          shown.map((b) => (
            <View key={b.key} style={{ gap: 6 }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <T v="h3" numberOfLines={1}>
                    {b.key}
                  </T>
                  <T v="tiny">
                    {b.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: b.sessions })}
                    {b.hours >= 0.25 && b.mtts < b.sessions ? ' · ' + t('{amount}/h', { amount: fmt(Math.round(b.hourly), cur) }) : ''}
                    {b.roi !== null ? ' · ROI ' + pctOf(b.roi) : ''}
                  </T>
                </View>
                <T v="mono" color={b.profit >= 0 ? C.good : C.bad}>
                  {(b.profit > 0 ? '+' : '') + fmt(b.profit, cur)}
                </T>
              </Row>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: C.surface3 }}>
                <View style={{ width: `${(Math.abs(b.profit) / max) * 100}%`, height: 4, borderRadius: 2, backgroundColor: b.profit >= 0 ? C.good : C.bad }} />
              </View>
            </View>
          ))
        )}
        {!isPro && rows.length > 1 ? <Button kind="outline" size="sm" icon="lock-closed" title={t('Ver todas ({n}) com Pro', { n: rows.length })} onPress={() => paywall('stats')} style={{ alignSelf: 'flex-start' }} /> : null}
      </Card>
    </Section>
  );
}

function SessionRow({ s, bankroll, onDelete, onEdit }: { s: Session; bankroll?: string; onDelete: () => void; onEdit: () => void }) {
  const fmt = useFmt();
  const [open, setOpen] = useState(false);
  const p = profit(s);
  const mtt = s.kind === 'mtt';
  return (
    <View>
      <ListItem
        icon={mtt ? 'trophy-outline' : 'cash-outline'}
        iconColor={mtt ? C.warn : C.info}
        title={s.name || (mtt ? t('Torneio') : 'Cash')}
        subtitle={[isBagged(s) ? t('Ensacado') + ' ' + chips(s.bag!.stack) : '', shortDate(s.startedAt), duration(playedMs(s)), formatOf(s) === 'online' ? 'Online' : '', bankroll, s.venue, s.finish ? t('{n}º', { n: s.finish }) + (s.field ? '/' + s.field : '') : ''].filter(Boolean).join(' · ')}
        right={
          <T v="mono" color={p > 0 ? C.good : p < 0 ? C.bad : C.textDim}>
            {(p > 0 ? '+' : '') + fmt(p, s.currency)}
          </T>
        }
        chevron={false}
        onPress={() => setOpen((o) => !o)}
      />
      {open && (
        <View style={{ paddingHorizontal: S.lg, paddingBottom: S.md, gap: S.md }}>
          <T v="small">
            {s.entries} × {fmt(s.buyIn, s.currency)}
            {s.addOn ? ` + ${s.kind === 'mtt' ? 'add-on' : 'top-up'} ${fmt(s.addOn, s.currency)}` : ''} → {fmt(s.cashOut, s.currency)}
            {s.staking?.sold ? '\n' + t('{sold}% vendido a {markup} · aos backers {owed}', { sold: s.staking.sold, markup: dec(s.staking.markup), owed: fmt(owedToBackers(s), s.currency) }) : ''}
            {s.makeupCut ? '\n' + t('A tua parte do pacote {amount}', { amount: fmt(s.makeupCut, s.currency) }) : ''}
            {s.expenses ? '\n' + t('Despesas {amount}', { amount: fmt(s.expenses, s.currency) }) : ''}
            {s.tips ? '\n' + t('Gorjetas {amount}', { amount: fmt(s.tips, s.currency) }) : ''}
            {s.handsDealt ? '\n' + t('{n} mãos jogadas', { n: s.handsDealt }) : ''}
          </T>
          <Row gap={S.sm}>
            <Button size="sm" kind="secondary" icon="share-outline" title={t('Partilhar')} onPress={() => router.push(`/session-card/${s.id}`)} />
            <Button size="sm" kind="secondary" icon="pencil" title={t('Editar')} onPress={onEdit} />
            <Button size="sm" kind="danger" icon="trash-outline" title={t('Apagar')} onPress={onDelete} />
          </Row>
        </View>
      )}
    </View>
  );
}

/**
 * Staking, trips and swaps stay one tap away without crowding a bankroll
 * that doesn't use them: a tool shows on its own once it has something in
 * it, and the rest wait behind one "Mais ferramentas" row.
 */
function MoreTools() {
  const { backers, trips } = useStore();
  const { swaps } = useSwaps();
  const [open, setOpen] = useState(false);
  const tools = [
    { key: 'staking', used: backers.length > 0, el: <StakingEntry key="staking" />, name: 'Staking' },
    { key: 'trips', used: trips.length > 0, el: <TripsEntry key="trips" />, name: t('viagens') },
    { key: 'swaps', used: swaps.length > 0, el: <SwapsEntry key="swaps" />, name: 'swaps' },
  ];
  const idle = tools.filter((x) => !x.used);
  return (
    <>
      {tools.filter((x) => x.used).map((x) => x.el)}
      {idle.length ? (
        open ? (
          idle.map((x) => x.el)
        ) : (
          <ListGroup>
            <ListItem icon="grid-outline" title={t('Mais ferramentas')} subtitle={idle.map((x) => x.name).join(', ').replace(/^./, (c) => c.toUpperCase())} onPress={() => setOpen(true)} />
          </ListGroup>
        )
      ) : null}
    </>
  );
}
