import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { LineChart } from '@/components/LineChart';
import { BankrollForm, blankTransfer, effectiveRange, FilterForm, rangeLabel, Sheet, TransferForm } from '@/components/BankrollSheets';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { StakingEntry } from '@/components/staking/StakingEntry';
import { Button, Card, Chip, ChipRow, confirmAction, Empty, IconButton, ListGroup, ListItem, Row, Screen, Section, Segmented, Stat, StatGrid, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { duration, money, shortDate } from '@/poker/format';
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
  stakeOptions,
  transfersIn,
  type DateRange,
  type RangePreset,
  type Scope,
  type SessionFilter,
} from '@/store/bankroll-math';
import { breakdown, curve, owedToBackers, playedMs, profit, totals } from '@/store/session-math';
import { uid, useStore } from '@/store/store';
import type { Bankroll, Session, Transfer } from '@/store/types';
import { C, S } from '@/theme';

export default function BankrollScreen() {
  const { sessions, transfers, bankrolls, defaultBankroll, saveSession, deleteSession, saveBankroll, deleteBankroll, saveTransfer, deleteTransfer, settings } = useStore();
  const { isPro, paywall } = usePro();
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
  const pts = curve(list, cur).map((p) => p.v);
  const onlyResults = game !== 'all' || format !== 'all' || stakes.length > 0;
  const history = ledger(list, onlyResults ? [] : scopedTx.filter((x) => inRange(x.at, range)));
  const nFilters = activeFilters(filter);
  const scopeBankrolls = bankrolls.filter((b) => inScope.has(b.id));
  const single = 'bankrollId' in scope ? bankrolls.find((b) => b.id === scope.bankrollId) : undefined;
  const scopeName = single?.name ?? t('Todas {currency}', { currency: cur });
  const pct = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(0)}%`;
  const signedMoney = (n: number) => (n > 0 ? '+' : '') + money(n, cur);
  const pastBankroll = single ?? scopeBankrolls[0] ?? defaultBankroll;

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
      <Screen title="Bankroll" right={<IconButton name="add" label={t('Sessão passada')} onPress={() => setSheet({ type: 'session', s: 'new' })} />} contentStyle={{ gap: S.lg }}>
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
            {single ? <IconButton name="ellipsis-horizontal" size={30} label={t('Gerir bankroll')} onPress={() => setSheet({ type: 'bankroll', b: single })} /> : null}
          </Row>
          <T v="monoXL" color={bal.balance < 0 ? C.bad : C.text} numberOfLines={1} adjustsFontSizeToFit>
            {money(bal.balance, cur)}
          </T>
          <T v="small" numberOfLines={2}>
            {[
              t('Resultado {amount}', { amount: signedMoney(bal.results) }),
              bal.deposits ? t('Depósitos {amount}', { amount: money(bal.deposits, cur) }) : '',
              bal.withdrawals ? t('Levantamentos {amount}', { amount: money(bal.withdrawals, cur) }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
          <Row gap={S.sm} style={{ marginTop: S.xs }}>
            <Button style={{ flex: 1 }} size="sm" kind="secondary" icon="arrow-down" title={t('Depositar')} onPress={() => setSheet({ type: 'transfer', x: blankTransfer(pastBankroll.id, 'deposit'), isNew: true })} />
            <Button style={{ flex: 1 }} size="sm" kind="secondary" icon="arrow-up" title={t('Levantar')} onPress={() => setSheet({ type: 'transfer', x: blankTransfer(pastBankroll.id, 'withdrawal'), isNew: true })} />
          </Row>
        </Card>

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
            <Chip icon={locked ? 'lock-closed' : 'calendar-outline'} label={rangeLabel(preset, custom)} active={preset !== 'all'} onPress={openFilters} />
            <Chip icon={locked ? 'lock-closed' : 'layers-outline'} label={stakes.length ? t('Stakes · {n}', { n: stakes.length }) : t('Todas as stakes')} active={stakes.length > 0} onPress={openFilters} />
            {nFilters ? <Chip icon="close" label={t('Limpar')} onPress={clearFilters} /> : null}
          </ChipRow>
        </View>

        <StakingEntry />

        {tot.sessions === 0 ? (
          nFilters ? (
            <Empty icon="funnel-outline" title={t('Nada com estes filtros')} body={t('Nenhuma sessão terminada encaixa no que escolheste.')} action={<Button title={t('Limpar filtros')} kind="secondary" size="md" onPress={clearFilters} />} />
          ) : (
            <Empty
              icon="stats-chart"
              title={t('Ainda sem sessões')}
              body={t('Termina uma sessão ao vivo ou junta uma que já jogaste. O lucro, o €/hora e o ROI aparecem aqui.')}
              action={<Button title={t('Juntar sessão passada')} icon="add" kind="secondary" size="md" onPress={() => setSheet({ type: 'session', s: 'new' })} />}
            />
          )
        ) : (
          <>
            <Card style={{ gap: S.sm, paddingBottom: S.md }}>
              <T v="label">{nFilters ? t('Lucro · filtrado') : t('Lucro')}</T>
              <T v="monoL" color={tot.profit >= 0 ? C.good : C.bad} numberOfLines={1} adjustsFontSizeToFit>
                {signedMoney(tot.profit)}
              </T>
              <T v="small">
                {(tot.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: tot.sessions })) + ' · ' + t('{h} h a jogar', { h: tot.hours.toLocaleString(locale, { maximumFractionDigits: 1 }) })}
              </T>
              <View style={{ marginTop: S.sm, marginHorizontal: -S.xs }}>
                <LineChart values={pts} height={120} />
              </View>
            </Card>
            <StatGrid cols={3}>
              <Stat label={t('Por hora')} value={tot.hours >= 0.25 ? money(Math.round(tot.hourly), cur) : '—'} tone={tot.hourly > 0 ? 'good' : tot.hourly < 0 ? 'bad' : undefined} />
              {tot.roi !== null ? <Stat label="ROI" value={pct(tot.roi)} tone={tot.roi > 0 ? 'good' : tot.roi < 0 ? 'bad' : undefined} /> : null}
              {tot.itm !== null ? <Stat label="ITM" value={`${tot.itm.toFixed(0)}%`} /> : null}
              <Stat label={t('Investido')} value={money(tot.invested, cur)} />
              <Stat label={t('Melhor')} value={money(tot.best, cur)} tone="good" />
              <Stat label={t('Pior')} value={money(tot.worst, cur)} tone={tot.worst < 0 ? 'bad' : undefined} />
            </StatGrid>
            <Breakdowns list={list} cur={cur} />
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
            onSave={(x) => {
              saveTransfer(x);
              setSheet(null);
            }}
            onDelete={
              sheet.isNew
                ? undefined
                : () =>
                    confirmAction(t('Apagar este movimento?'), money(sheet.x.amount, cur), t('Apagar'), () => {
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
  | { type: 'filters' };

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
          {(dep ? '+' : '−') + money(Math.abs(x.amount), cur)}
        </T>
      }
      chevron={false}
      onPress={onPress}
    />
  );
}

function Breakdowns({ list, cur }: { list: Session[]; cur: string }) {
  const { isPro, paywall } = usePro();
  const [by, setBy] = useState<'venue' | 'name'>('venue');
  const rows = breakdown(list, by, cur);
  if (breakdown(list, 'venue', cur).length + breakdown(list, 'name', cur).length === 0) return null;
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
                    {b.hours >= 0.25 ? ' · ' + t('{amount}/h', { amount: money(Math.round(b.hourly), cur) }) : ''}
                  </T>
                </View>
                <T v="mono" color={b.profit >= 0 ? C.good : C.bad}>
                  {(b.profit > 0 ? '+' : '') + money(b.profit, cur)}
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
  const [open, setOpen] = useState(false);
  const p = profit(s);
  const mtt = s.kind === 'mtt';
  return (
    <View>
      <ListItem
        icon={mtt ? 'trophy-outline' : 'cash-outline'}
        iconColor={mtt ? C.warn : C.info}
        title={s.name || (mtt ? t('Torneio') : 'Cash')}
        subtitle={[shortDate(s.startedAt), duration(playedMs(s)), formatOf(s) === 'online' ? 'Online' : '', bankroll, s.venue, s.finish ? t('{n}º', { n: s.finish }) + (s.field ? '/' + s.field : '') : ''].filter(Boolean).join(' · ')}
        right={
          <T v="mono" color={p > 0 ? C.good : p < 0 ? C.bad : C.textDim}>
            {(p > 0 ? '+' : '') + money(p, s.currency)}
          </T>
        }
        chevron={false}
        onPress={() => setOpen((o) => !o)}
      />
      {open && (
        <View style={{ paddingHorizontal: S.lg, paddingBottom: S.md, gap: S.md }}>
          <T v="small">
            {s.entries} × {money(s.buyIn, s.currency)}
            {s.addOn ? ` + add-on ${money(s.addOn, s.currency)}` : ''} → {money(s.cashOut, s.currency)}
            {s.staking?.sold ? '\n' + t('{sold}% vendido a {markup} · aos backers {owed}', { sold: s.staking.sold, markup: s.staking.markup.toFixed(2), owed: money(owedToBackers(s), s.currency) }) : ''}
            {s.makeupCut ? '\n' + t('A tua parte do pacote {amount}', { amount: money(s.makeupCut, s.currency) }) : ''}
            {s.expenses ? '\n' + t('Despesas {amount}', { amount: money(s.expenses, s.currency) }) : ''}
          </T>
          <Row gap={S.sm}>
            <Button size="sm" kind="secondary" icon="pencil" title={t('Editar')} onPress={onEdit} />
            <Button size="sm" kind="danger" icon="trash-outline" title={t('Apagar')} onPress={onDelete} />
          </Row>
        </View>
      )}
    </View>
  );
}
