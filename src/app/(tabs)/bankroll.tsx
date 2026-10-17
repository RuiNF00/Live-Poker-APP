import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { LineChart } from '@/components/LineChart';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { Button, Card, confirmAction, Empty, IconButton, ListGroup, ListItem, Row, Screen, Section, Segmented, SheetHeader, Stat, StatGrid, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { duration, money, shortDate } from '@/poker/format';
import { breakdown, curve, owedToBackers, playedMs, profit, totals } from '@/store/session-math';
import { uid, useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, S } from '@/theme';

type Kind = 'all' | 'mtt' | 'cash';
type Period = 30 | 90 | 365 | 0;

export default function BankrollScreen() {
  const { sessions, saveSession, deleteSession, settings } = useStore();
  const { isPro, paywall } = usePro();
  const [kind, setKind] = useState<Kind>('all');
  const [period, setPeriod] = useState<Period>(0);
  // 'new' for a past session, or the session being edited.
  const [editing, setEditing] = useState<Session | 'new' | null>(null);
  const cur = settings.currency;
  const locked = !isPro && !FREE.bankrollFilters;

  const list = useMemo(() => {
    const since = period ? Date.now() - period * 86400000 : 0;
    return sessions.filter((s) => (kind === 'all' || s.kind === kind) && s.startedAt >= since);
  }, [sessions, kind, period]);
  const tot = totals(list);
  const pts = curve(list).map((p) => p.v);
  const done = list.filter((s) => s.endedAt).sort((a, b) => b.startedAt - a.startedAt);
  const pct = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(0)}%`;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen title="Bankroll" right={<IconButton name="add" label={t('Sessão passada')} onPress={() => setEditing('new')} />} contentStyle={{ gap: S.lg }}>
        <View style={{ gap: S.sm }}>
          <Segmented
            options={[
              { key: 'all', label: t('Tudo') },
              { key: 'mtt', label: t('Torneios') },
              { key: 'cash', label: 'Cash' },
            ]}
            value={kind}
            onChange={setKind}
          />
          <Segmented
            size="sm"
            options={([[30, '30d'], [90, '90d'], [365, t('1 ano')], [0, t('Sempre')]] as [Period, string][]).map(([p, l]) => ({ key: p, label: l, locked: !!p && locked }))}
            value={period}
            onChange={(p) => (p && locked ? paywall('stats') : setPeriod(p))}
          />
        </View>

        {tot.sessions === 0 ? (
          <Empty
            icon="stats-chart"
            title={t('Ainda sem sessões')}
            body={t('Termina uma sessão ao vivo ou junta uma que já jogaste. O lucro, o €/hora e o ROI aparecem aqui.')}
            action={<Button title={t('Juntar sessão passada')} icon="add" kind="secondary" size="md" onPress={() => setEditing('new')} />}
          />
        ) : (
          <>
            <Card tone="raised" style={{ gap: S.sm, paddingBottom: S.md }}>
              <T v="label">{t('Lucro')}</T>
              <T v="monoXL" color={tot.profit >= 0 ? C.good : C.bad} numberOfLines={1} adjustsFontSizeToFit>
                {(tot.profit > 0 ? '+' : '') + money(tot.profit, cur)}
              </T>
              <T v="small">
                {(tot.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: tot.sessions })) + ' · ' + t('{h} h a jogar', { h: tot.hours.toLocaleString(locale, { maximumFractionDigits: 1 }) })}
              </T>
              <View style={{ marginTop: S.sm, marginHorizontal: -S.xs }}>
                <LineChart values={pts} height={130} />
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
            <Section title={t('Histórico')}>
              <ListGroup>
                {done.map((s) => (
                  <SessionRow key={s.id} s={s} onDelete={() => confirmAction(t('Apagar esta sessão?'), s.name || '', t('Apagar'), () => deleteSession(s.id))} onEdit={() => setEditing(s)} />
                ))}
              </ListGroup>
            </Section>
          </>
        )}
      </Screen>
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)} presentationStyle="pageSheet">
        <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingTop: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <SheetHeader title={editing && editing !== 'new' ? t('Editar sessão') : t('Sessão passada')} onClose={() => setEditing(null)} closeLabel={t('Fechar')} />
          {editing ? (
            <SessionForm
              key={editing === 'new' ? 'new' : editing.id}
              past
              initial={editing === 'new' ? blankSession('mtt', cur, settings.defaultTableSize) : editing}
              recentNames={[...new Set(sessions.map((s) => s.name).filter(Boolean))].slice(0, 8)}
              recentVenues={[...new Set(sessions.map((s) => s.venue).filter(Boolean))].slice(0, 8)}
              submitLabel={t('Guardar sessão')}
              onSubmit={(s) => {
                // A new past session always gets a fresh id; an edit keeps its own.
                saveSession(editing === 'new' ? { ...s, id: uid('s_') } : s);
                setEditing(null);
              }}
            />
          ) : null}
        </ScrollView>
      </Modal>
    </View>
  );
}

function Breakdowns({ list, cur }: { list: Session[]; cur: string }) {
  const { isPro, paywall } = usePro();
  const [by, setBy] = useState<'venue' | 'name'>('venue');
  const rows = breakdown(list, by);
  if (breakdown(list, 'venue').length + breakdown(list, 'name').length === 0) return null;
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

function SessionRow({ s, onDelete, onEdit }: { s: Session; onDelete: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const p = profit(s);
  const mtt = s.kind === 'mtt';
  return (
    <View>
      <ListItem
        icon={mtt ? 'trophy-outline' : 'cash-outline'}
        iconColor={mtt ? C.warn : C.info}
        title={s.name || (mtt ? t('Torneio') : 'Cash')}
        subtitle={[shortDate(s.startedAt), duration(playedMs(s)), s.venue, s.finish ? t('{n}º', { n: s.finish }) + (s.field ? '/' + s.field : '') : ''].filter(Boolean).join(' · ')}
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
