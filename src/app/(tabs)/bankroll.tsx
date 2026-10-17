import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { LineChart } from '@/components/LineChart';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { Button, Chip, Empty, Panel, Row, T } from '@/components/ui';
import { t } from '@/i18n';
import { duration, money, shortDate } from '@/poker/format';
import { curve, playedMs, profit, totals } from '@/store/session-math';
import { useStore } from '@/store/store';
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
  const [adding, setAdding] = useState(false);
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
          <Button small kind="secondary" title={t('+ Sessão passada')} onPress={() => setAdding(true)} />
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
              <Stat label={t('Por hora')} value={money(Math.round(tot.hourly), cur)} />
              <Stat label={t('Horas')} value={tot.hours.toFixed(1)} />
              <Stat label={t('Sessões')} value={String(tot.sessions)} />
              {tot.roi !== null ? <Stat label={t('ROI torneios')} value={`${tot.roi.toFixed(0)}%`} /> : null}
              {tot.itm !== null ? <Stat label="ITM" value={`${tot.itm.toFixed(0)}%`} /> : null}
              <Stat label={t('Investido')} value={money(tot.invested, cur)} />
              <Stat label={t('Melhor')} value={money(tot.best, cur)} />
              <Stat label={t('Pior')} value={money(tot.worst, cur)} />
            </Row>
            <T v="h2">{t('Histórico')}</T>
            {done.map((s) => (
              <SessionRow key={s.id} s={s} onDelete={() => deleteSession(s.id)} />
            ))}
          </>
        )}
      </ScrollView>
      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)} presentationStyle="pageSheet">
        <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h1">{t('Sessão passada')}</T>
            <Pressable onPress={() => setAdding(false)}>
              <T v="body" color={C.textDim}>
                {t('Fechar')}
              </T>
            </Pressable>
          </Row>
          <SessionForm
            past
            initial={blankSession('mtt', cur)}
            recentNames={[...new Set(sessions.map((s) => s.name).filter(Boolean))].slice(0, 8)}
            recentVenues={[...new Set(sessions.map((s) => s.venue).filter(Boolean))].slice(0, 8)}
            submitLabel={t('Guardar sessão')}
            onSubmit={(s) => {
              saveSession(s);
              setAdding(false);
            }}
          />
        </ScrollView>
      </Modal>
    </View>
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

function SessionRow({ s, onDelete }: { s: Session; onDelete: () => void }) {
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
          </T>
          <Pressable onPress={onDelete} hitSlop={8}>
            <T v="small" color={C.danger}>
              {t('Apagar')}
            </T>
          </Pressable>
        </Row>
      )}
    </Pressable>
  );
}
