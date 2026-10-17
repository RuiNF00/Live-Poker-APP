import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { LineChart } from '@/components/LineChart';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { Button, Chip, Empty, Panel, Row, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { duration, money, shortDate } from '@/poker/format';
import { breakdown, curve, owedToBackers, playedMs, profit, totals } from '@/store/session-math';
import { uid, useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, R, ff } from '@/theme';

type Kind = 'all' | 'mtt' | 'cash';
type Period = 30 | 90 | 365 | 0;

export default function BankrollScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, saveSession, deleteSession, settings } = useStore();
  const { isPro, paywall } = usePro();
  const [kind, setKind] = useState<Kind>('all');
  const [period, setPeriod] = useState<Period>(0);
  // 'new' for a past session, or the session being edited.
  const [editing, setEditing] = useState<Session | 'new' | null>(null);
  const cur = settings.currency;

  const list = useMemo(() => {
    const since = period ? Date.now() - period * 86400000 : 0;
    return sessions.filter((s) => (kind === 'all' || s.kind === kind) && s.startedAt >= since);
  }, [sessions, kind, period]);
  const tot = totals(list);
  const pts = curve(list).map((p) => p.v);
  const done = list.filter((s) => s.endedAt).sort((a, b) => b.startedAt - a.startedAt);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, padding: 14, gap: 14, paddingBottom: 60 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="title">Bankroll</T>
          <Button small kind="secondary" title={t('+ Sessão passada')} onPress={() => setEditing('new')} />
        </Row>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Chip label={t('Tudo')} active={kind === 'all'} onPress={() => setKind('all')} />
          <Chip label={t('Torneios')} active={kind === 'mtt'} onPress={() => setKind('mtt')} />
          <Chip label="Cash" active={kind === 'cash'} onPress={() => setKind('cash')} />
          <View style={{ width: 8 }} />
          {([[30, '30d'], [90, '90d'], [365, t('1 ano')], [0, t('Sempre')]] as [Period, string][]).map(([p, l]) => (
            <Chip key={l} label={p && !isPro && !FREE.bankrollFilters ? l + ' · Pro' : l} active={period === p} onPress={() => (p && !isPro && !FREE.bankrollFilters ? paywall('stats') : setPeriod(p))} />
          ))}
        </Row>

        {tot.sessions === 0 ? (
          <Empty title={t('Ainda sem sessões terminadas')} body={t('Começa uma sessão no separador Sessão ou adiciona uma sessão passada para ver lucro, hora a hora e ROI.')} />
        ) : (
          <>
            <Panel style={{ gap: 4 }}>
              <T v="label">{t('Lucro')}</T>
              <T style={{ fontSize: 38, fontWeight: '800', fontFamily: ff(800), color: tot.profit >= 0 ? C.good : C.bad }}>{money(tot.profit, cur)}</T>
              <LineChart values={pts} />
            </Panel>
            <Row gap={10} style={{ flexWrap: 'wrap' }}>
              <Stat label={t('Por hora')} value={tot.hours >= 0.25 ? money(Math.round(tot.hourly), cur) : '—'} />
              <Stat label={t('Horas')} value={tot.hours.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />
              <Stat label={t('Sessões')} value={String(tot.sessions)} />
              {tot.roi !== null ? <Stat label={t('ROI torneios')} value={`${tot.roi < 0 ? '−' : ''}${Math.abs(tot.roi).toFixed(0)}%`} /> : null}
              {tot.itm !== null ? <Stat label="ITM" value={`${tot.itm.toFixed(0)}%`} /> : null}
              <Stat label={t('Investido')} value={money(tot.invested, cur)} />
              <Stat label={t('Melhor')} value={money(tot.best, cur)} />
              <Stat label={t('Pior')} value={money(tot.worst, cur)} />
            </Row>
            <Breakdowns list={list} cur={cur} />
            <T v="h2">{t('Histórico')}</T>
            {done.map((s) => (
              <SessionRow key={s.id} s={s} onDelete={() => deleteSession(s.id)} onEdit={() => setEditing(s)} />
            ))}
          </>
        )}
      </ScrollView>
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)} presentationStyle="pageSheet">
        <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h1">{editing && editing !== 'new' ? t('Editar sessão') : t('Sessão passada')}</T>
            <Pressable onPress={() => setEditing(null)}>
              <T v="body" color={C.textDim}>
                {t('Fechar')}
              </T>
            </Pressable>
          </Row>
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
  return (
    <Panel style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h2">{t('Onde ganhas')}</T>
        <Row gap={6}>
          <Chip label={t('Salas')} active={by === 'venue'} onPress={() => setBy('venue')} />
          <Chip label={t('Jogos')} active={by === 'name'} onPress={() => setBy('name')} />
        </Row>
      </Row>
      {rows.length === 0 ? (
        <T v="small">{by === 'venue' ? t('Dá um nome à sala nas sessões para ver aqui.') : t('Dá um nome ao jogo nas sessões para ver aqui.')}</T>
      ) : (
        shown.map((b) => (
          <Row key={b.key} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T v="body" numberOfLines={1} style={{ fontWeight: '700', fontFamily: ff(700) }}>
                {b.key}
              </T>
              <T v="tiny">
                {b.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: b.sessions })}
                {b.hours >= 0.25 ? ' · ' + t('{amount}/h', { amount: money(Math.round(b.hourly), cur) }) : ''}
              </T>
            </View>
            <T v="mono" color={b.profit >= 0 ? C.good : C.bad}>
              {money(b.profit, cur)}
            </T>
          </Row>
        ))
      )}
      {!isPro && rows.length > 1 ? (
        <Pressable onPress={() => paywall('stats')} hitSlop={6}>
          <T v="small" color={C.accent}>
            {t('Ver todas ({n}) · Pro', { n: rows.length })}
          </T>
        </Pressable>
      ) : null}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexGrow: 1, minWidth: '30%', backgroundColor: C.surface, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.border, gap: 2 }}>
      <T v="label">{label}</T>
      <T v="h2">{value}</T>
    </View>
  );
}

function SessionRow({ s, onDelete, onEdit }: { s: Session; onDelete: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const p = profit(s);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.border, gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T v="body" style={{ fontWeight: '700', fontFamily: ff(700) }} numberOfLines={1}>
            {s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash')}
          </T>
          <T v="tiny">
            {shortDate(s.startedAt)} · {duration(playedMs(s))}
            {s.venue ? ' · ' + s.venue : ''}
            {s.finish ? ' · ' + t('{n}º', { n: s.finish }) + (s.field ? '/' + s.field : '') : ''}
          </T>
        </View>
        <T v="mono" color={p >= 0 ? C.good : C.bad}>
          {money(p, s.currency)}
        </T>
      </Row>
      {open && (
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small">
            {s.entries} × {money(s.buyIn, s.currency)}
            {s.addOn ? ` + add-on ${money(s.addOn, s.currency)}` : ''} → {money(s.cashOut, s.currency)}
            {s.staking?.sold ? '\n' + t('{sold}% vendido a {markup} · aos backers {owed}', { sold: s.staking.sold, markup: s.staking.markup.toFixed(2), owed: money(owedToBackers(s), s.currency) }) : ''}
            {s.expenses ? '\n' + t('Despesas {amount}', { amount: money(s.expenses, s.currency) }) : ''}
          </T>
          <Row gap={14}>
            <Pressable onPress={onEdit} hitSlop={8}>
              <T v="small" color={C.accent}>
                {t('Editar')}
              </T>
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={8}>
              <T v="small" color={C.danger}>
                {t('Apagar')}
              </T>
            </Pressable>
          </Row>
        </Row>
      )}
    </Pressable>
  );
}
