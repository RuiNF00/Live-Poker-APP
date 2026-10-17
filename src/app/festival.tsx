// Festival planner: the published schedule of a live festival, the events the
// player plans to play, what they add up to against the bankroll, reminders
// before each start and before late reg closes, and one tap from a planned
// event to a running session.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { usePro } from '@/billing/pro';
import { FREE } from '@/billing/plans';
import { blankSession } from '@/components/SessionForm';
import { Button, Card, Chip, ChipRow, Row, Section, T, tap } from '@/components/ui';
import { locale, t } from '@/i18n';
import { syncFestivalReminders } from '@/lib/festival-reminders';
import { eventDay, eventTitle, FESTIVALS, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';
import { money } from '@/poker/format';
import { balanceOf } from '@/store/bankroll-math';
import { bankrollShare, eventAction, planTotals, REMIND_BEFORE_MIN, togglePicked, updatePlan, useFestivalPlan, type EventAction, type FestivalPlan } from '@/store/festival-plan';
import { dayOf, reenterFlight, resumeDay } from '@/store/multi-day';
import { uid, useStore } from '@/store/store';
import { tripFromFestival } from '@/store/trip-math';
import type { Session } from '@/store/types';
import { C, R, S } from '@/theme';

type Filter = 'all' | 'mine' | 'NLH' | 'PLO' | 'Mix';
const LATE_REG_HOURS = [2, 3, 4, 5, 6, 8];

/** $50M, $2.5M, $750k. */
function short(n: number, cur: string) {
  if (n >= 1e6) return `${cur}${+(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`;
  if (n >= 1e3) return `${cur}${+(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}k`;
  return `${cur}${n}`;
}

function dayLabel(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export default function FestivalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const f = FESTIVALS.find((x) => x.id === id) ?? FESTIVALS[0];
  const plan = useFestivalPlan(f.id);
  const { sessions, transfers, bankrolls, defaultBankroll, activeSession, saveSession, settings } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [lateFor, setLateFor] = useState<string | null>(null);
  const [softAsk, askNotify] = useNotifySoftAsk();

  // The bankroll in the festival's currency, if there is one; otherwise the default (no % then).
  const bankroll = bankrolls.find((b) => b.currency === f.currency) ?? defaultBankroll;
  const sameCurrency = bankroll.currency === f.currency;
  const balance = balanceOf({ bankrollId: bankroll.id }, sessions, transfers, bankrolls).balance;
  const tot = planTotals(f, plan);
  const share = sameCurrency ? bankrollShare(tot.buyIns, balance) : null;

  useEffect(() => {
    void syncFestivalReminders(f, plan);
  }, [f, plan]);

  const days = useMemo(() => {
    const list = f.events.filter((e) => (filter === 'all' ? true : filter === 'mine' ? plan.picked.includes(e.id) : e.game === filter));
    const by = new Map<string, FestivalEvent[]>();
    for (const e of list) by.set(eventDay(e), [...(by.get(eventDay(e)) ?? []), e]);
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [f, filter, plan.picked]);

  const toggle = (e: FestivalEvent) => {
    tap('select');
    if (!plan.picked.length)
      void askNotify({
        title: t('Avisamos-te antes de cada torneio que escolheres'),
        preview: { title: t('Começa daqui a {n} min', { n: REMIND_BEFORE_MIN }), body: eventTitle(e) },
      });
    updatePlan(f.id, (p) => togglePicked(p, e.id));
  };

  const startSession = (e: FestivalEvent) => {
    const a = eventAction(f, plan, sessions, e);
    if (!a) return;
    if (a.kind === 'view') return router.push('/session');
    if (activeSession) {
      const msg = t('Termina a sessão "{name}" antes de começar outra.', { name: activeSession.name || t('Sessão') });
      if (Platform.OS === 'web') router.push('/session');
      else Alert.alert(t('Já tens uma sessão a decorrer'), msg, [{ text: t('Ver sessão'), onPress: () => router.push('/session') }, { text: t('Cancelar'), style: 'cancel' }]);
      return;
    }
    tap('medium');
    const s =
      a.kind === 'resume'
        ? resumeDay(a.session)
        : a.kind === 'reenter'
          ? reenterFlight(a.session, sessionName(e))
          : sessionFromEvent(f, e, settings.defaultTableSize, sameCurrency ? bankroll.id : undefined);
    saveSession(s);
    updatePlan(f.id, (p) => ({ ...p, picked: p.picked.includes(e.id) ? p.picked : [...p.picked, e.id], sessions: { ...p.sessions, [e.id]: s.id } }));
    router.push('/session');
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Festival') }} />
      {softAsk}
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}>
        <View style={{ gap: 4 }}>
          <Row gap={8}>
            <TextInput
              value={plan.name ?? t(f.name)}
              onChangeText={(name) => updatePlan(f.id, (p) => ({ ...p, name }))}
              onBlur={() => updatePlan(f.id, (p) => ({ ...p, name: p.name?.trim() || undefined }))}
              placeholder={t(f.name)}
              placeholderTextColor={C.textDim}
              accessibilityLabel={t('Nome do festival')}
              returnKeyType="done"
              maxLength={60}
              style={{ flex: 1, minWidth: 0, color: C.text, fontSize: 24, fontWeight: '700', paddingVertical: 2 }}
            />
            <Ionicons name="pencil" size={16} color={C.textDim} />
          </Row>
          <T v="label">{`${f.venue} · ${f.city}`}</T>
          <T v="small">{t('Marca os eventos que vais jogar. Avisamos-te 30 min antes de cada um e antes de fechar o late reg.')}</T>
        </View>

        <Summary f={f} tot={tot} balance={balance} share={share} bankrollName={bankroll.name} bankrollCurrency={bankroll.currency} sameCurrency={sameCurrency} />
        <TripLink f={f} plan={plan} />

        <ChipRow>
          {(
            [
              ['all', t('Todos')],
              ['mine', t('Os meus ({n})', { n: tot.events })],
              ['NLH', 'NLH'],
              ['PLO', 'PLO'],
              ['Mix', 'Mix'],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <Chip key={k} label={label} active={filter === k} onPress={() => setFilter(k)} />
          ))}
        </ChipRow>

        {days.length === 0 ? (
          <Card tone="inset">
            <T v="small">{t('Ainda não marcaste nenhum evento. Toca no círculo à direita de um evento para o adicionar.')}</T>
          </Card>
        ) : null}

        {days.map(([day, list]) => (
          <Section key={day} title={dayLabel(day)}>
            <View style={{ gap: S.sm }}>
              {list.map((e) => (
                <EventRow
                  key={e.id}
                  f={f}
                  e={e}
                  plan={plan}
                  action={eventAction(f, plan, sessions, e)}
                  lateOpen={lateFor === e.id}
                  onToggle={() => toggle(e)}
                  onLate={() => setLateFor(lateFor === e.id ? null : e.id)}
                  onSetLate={(min) => {
                    tap('select');
                    updatePlan(f.id, (p) => {
                      const lateReg = { ...p.lateReg };
                      if (min) lateReg[e.id] = min;
                      else delete lateReg[e.id];
                      return { ...p, lateReg };
                    });
                    setLateFor(null);
                  }}
                  onStart={() => startSession(e)}
                />
              ))}
            </View>
          </Section>
        ))}

        <View style={{ gap: 6, paddingHorizontal: 4 }}>
          <T v="tiny" color={C.textDim}>
            {t('Fonte: {source}, verificado a {date}', { source: t(f.source.label), date: new Date(f.source.checked + 'T12:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}
          </T>
          {f.notes.map((n) => (
            <T key={n} v="tiny">
              {t(n)}
            </T>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

/** The trip for this festival: open it, or make it from the plan (dates from the planned events). */
function TripLink({ f, plan }: { f: Festival; plan: FestivalPlan }) {
  const { trips, settings, saveTrip } = useStore();
  const { isPro, paywall } = usePro();
  const trip = trips.find((x) => x.festivalId === f.id);
  const open = () => {
    if (trip) return router.push(`/trips/${trip.id}`);
    if (!isPro && FREE.trips !== null && trips.length >= FREE.trips) return paywall('stats');
    tap('medium');
    const x = tripFromFestival(uid('tr_'), f, plan, f.currency !== settings.currency ? { currency: settings.currency, rate: 0 } : undefined);
    saveTrip(x);
    router.push(`/trips/${x.id}`);
  };
  return (
    <Button
      size="md"
      kind="secondary"
      icon="airplane-outline"
      title={trip ? t('Ver viagem e despesas') : t('Criar viagem: voos, hotel e resultado líquido')}
      onPress={open}
    />
  );
}

function Summary({
  f,
  tot,
  balance,
  share,
  bankrollName,
  bankrollCurrency,
  sameCurrency,
}: {
  f: Festival;
  tot: ReturnType<typeof planTotals>;
  balance: number;
  share: number | null;
  bankrollName: string;
  bankrollCurrency: string;
  sameCurrency: boolean;
}) {
  const tone = share == null ? C.textDim : share > 1 ? C.bad : share > 0.5 ? C.warn : C.good;
  return (
    <Card tone="raised" style={{ gap: S.md }}>
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="label">{t('Buy-ins planeados')}</T>
          <T v="monoL">{money(tot.buyIns, f.currency)}</T>
          <T v="small">{tot.entries === 1 ? t('1 entrada') : t('{n} entradas', { n: tot.entries })}</T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <T v="label">{bankrollName}</T>
          <T v="mono">{money(balance, bankrollCurrency)}</T>
          {share != null ? (
            <T v="monoS" color={tone}>
              {t('{pct}% da banca', { pct: Math.round(share * 100) })}
            </T>
          ) : null}
        </View>
      </Row>
      {share != null ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surface3, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, Math.round(share * 100))}%`, height: 6, backgroundColor: tone }} />
        </View>
      ) : null}
      {sameCurrency && balance <= 0 ? (
        <T v="tiny">{t('Regista os teus depósitos no Bankroll para veres quanto da banca o plano usa.')}</T>
      ) : !sameCurrency ? (
        <T v="tiny">{t('A tua banca está em {cur} e o festival em {fcur}: cria uma banca em {fcur} para veres a percentagem.', { cur: bankrollCurrency, fcur: f.currency })}</T>
      ) : share != null && share > 1 ? (
        <T v="tiny" color={C.bad}>
          {t('O plano custa mais do que tens na banca.')}
        </T>
      ) : null}
    </Card>
  );
}

function EventRow({
  f,
  e,
  plan,
  action,
  lateOpen,
  onToggle,
  onLate,
  onSetLate,
  onStart,
}: {
  f: Festival;
  e: FestivalEvent;
  plan: FestivalPlan;
  action: EventAction | null;
  lateOpen: boolean;
  onToggle: () => void;
  onLate: () => void;
  onSetLate: (min: number | null) => void;
  onStart: () => void;
}) {
  const on = plan.picked.includes(e.id);
  const late = plan.lateReg[e.id];
  const start = venueTime(f, e.start);
  const lateLabel = late
    ? t('Late reg até {time}', { time: hm(new Date(start + late * 60_000), f.utcOffset) })
    : t('Hora do late reg');
  return (
    <Card tone={on ? 'accent' : 'default'} padded={false}>
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md }}>
        <View style={{ width: 48 }}>
          <T v="mono">{e.start.slice(11)}</T>
          <T v="tiny">{e.game}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3" numberOfLines={2}>
            {eventTitle(e)}
          </T>
          <T v="small" numberOfLines={1}>
            {[e.flight ? (e.day2 ? (e.flight === '2' ? t('Dia 2') : t('Dia 2 · Flight {f}', { f: e.flight })) : `Flight ${e.flight}`) : null, e.guarantee ? `${short(e.guarantee, f.currency)} GTD` : null].filter(Boolean).join(' · ')}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <T v="mono" color={e.day2 ? C.muted : C.text}>
            {e.day2 ? '—' : money(e.buyIn, f.currency)}
          </T>
          <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.accent : C.muted} />
        </View>
      </Pressable>
      {on || action?.kind === 'resume' ? (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <Row gap={S.sm}>
            {e.day2 ? <View style={{ flex: 1 }} /> : <Pressable
              onPress={onLate}
              accessibilityRole="button"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }}>
              <Ionicons name="alarm-outline" size={15} color={late ? C.text : C.accent} />
              <T v="small" color={late ? C.text : C.accent} numberOfLines={1} style={{ flexShrink: 1 }}>
                {lateLabel}
              </T>
            </Pressable>}
            {action ? (
              <Button
                size="sm"
                title={
                  action.kind === 'view'
                    ? t('Ver sessão')
                    : action.kind === 'resume'
                      ? t('Começar Dia {n}', { n: dayOf(action.session) + 1 })
                      : action.kind === 'reenter'
                        ? t('Re-entrar ({flight})', { flight: e.flight ? 'Flight ' + e.flight : eventTitle(e) })
                        : t('Começar sessão')
                }
                icon={action.kind === 'view' ? 'open-outline' : 'play'}
                onPress={onStart}
              />
            ) : null}
          </Row>
          {lateOpen ? (
            <View style={{ gap: 6 }}>
              <T v="tiny">{t('Quando fecha o late reg? (horas depois do início)')}</T>
              <ChipRow>
                {LATE_REG_HOURS.map((h) => (
                  <Chip key={h} label={`+${h}h · ${hm(new Date(start + h * 3_600_000), f.utcOffset)}`} active={late === h * 60} onPress={() => onSetLate(h * 60)} />
                ))}
                {late ? <Chip label={t('Limpar')} onPress={() => onSetLate(null)} /> : null}
              </ChipRow>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function sessionName(e: FestivalEvent) {
  return eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '');
}

/** A running tournament session for a festival event, starting now. */
function sessionFromEvent(f: Festival, e: FestivalEvent, tableSize: number, bankrollId: string | undefined): Session {
  const now = Date.now();
  const base = blankSession('mtt', f.currency, tableSize);
  return {
    ...base,
    name: sessionName(e),
    venue: `${f.venue}, ${f.city.split(',')[0]}`,
    buyIn: e.buyIn,
    bankrollId,
    startedAt: now,
    stackLog: [{ t: now, stack: base.stack, level: base.level }],
  };
}

/** Venue wall-clock HH:MM of an instant. */
function hm(d: Date, utcOffset: number) {
  const x = new Date(d.getTime() + utcOffset * 60_000);
  return `${String(x.getUTCHours()).padStart(2, '0')}:${String(x.getUTCMinutes()).padStart(2, '0')}`;
}
