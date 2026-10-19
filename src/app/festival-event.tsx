// One festival tournament in full, opened from its row in the planner: when it
// starts (also on the phone's clock abroad), what it costs and guarantees, the
// structure as published (stack, level length, late reg), its other flights
// and days, and the player's plan for it. Only what the organiser published:
// anything missing says so instead of a guess.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { useStartEvent } from '@/components/useStartEvent';
import { Badge, Button, Card, ListGroup, ListItem, Row, Section, Stat, StatGrid, T, tap } from '@/components/ui';
import { locale, t } from '@/i18n';
import { eventDay, eventTitle, type Festival, type FestivalEvent } from '@/poker/festivals';
import { chips, money, rawCompactMoney } from '@/poker/format';
import { balanceOf } from '@/store/bankroll-math';
import { entryFlights, flightLabel, hoursLabel, lateRegClose, phoneStart, tournamentRows } from '@/store/festival-event';
import { bankrollShare, clashes, entryBuyIn, eventAction, festivalName, lateRegOf, togglePicked, updatePlan, useFestivalPlan, venueHm, withPlanEvents } from '@/store/festival-plan';
import { dayOf } from '@/store/multi-day';
import { useFestivals, useFestivalsReady } from '@/store/my-festivals';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

function dayLabel(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

const GAME: Record<FestivalEvent['game'], string> = { NLH: "No Limit Hold'em", PLO: 'Pot Limit Omaha', Mix: 'Mixed Games' };

export default function FestivalEventScreen() {
  const { id, event } = useLocalSearchParams<{ id?: string; event?: string }>();
  const festivals = useFestivals();
  const ready = useFestivalsReady();
  const base = festivals.find((x) => x.id === id);
  const gone = ready && !base;
  useEffect(() => {
    if (gone) router.back();
  }, [gone]);
  return base && event ? <EventView key={base.id} base={base} eventId={event} /> : null;
}

function EventView({ base, eventId }: { base: Festival; eventId: string }) {
  const plan = useFestivalPlan(base.id);
  const f = useMemo(() => withPlanEvents(base, plan), [base, plan]);
  const e = f.events.find((x) => x.id === eventId);
  const { sessions, transfers, bankrolls, defaultBankroll } = useStore();
  const start = useStartEvent();
  // An added tournament deleted on another screen: back to the schedule.
  useEffect(() => {
    if (!e) router.back();
  }, [e]);
  const rows = useMemo(() => (e ? tournamentRows(f, e) : []), [f, e]);
  const clash = useMemo(() => clashes(f, plan), [f, plan]);
  if (!e) return null;

  const on = plan.picked.includes(e.id);
  const flight = flightLabel(e);
  const phone = phoneStart(f, e);
  const late = lateRegOf(plan, e);
  const close = lateRegClose(f, e, late);
  const cost = entryBuyIn(f, e);
  const bankroll = bankrolls.find((b) => b.currency === f.currency) ?? defaultBankroll;
  const balance = balanceOf({ bankrollId: bankroll.id }, sessions, transfers, bankrolls).balance;
  const share = bankroll.currency === f.currency && !e.day2 ? bankrollShare(e.buyIn, balance) : null;
  const action = eventAction(f, plan, sessions, e);
  const other = clash.get(e.id);
  const flights = entryFlights(rows);

  const toggle = () => {
    tap('select');
    updatePlan(f.id, (p) => togglePicked(p, e.id));
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Torneio') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}>
        <View style={{ gap: 6 }}>
          <T v="label">{festivalName(f, plan)}</T>
          <T v="h1" style={{ fontSize: 24 }}>
            {eventTitle(e)}
          </T>
          <Row gap={6} style={{ flexWrap: 'wrap', rowGap: 6 }}>
            <Badge label={GAME[e.game]} />
            {flight ? <Badge label={flight} color={C.accent} /> : null}
            {e.own ? <Badge label={t('Adicionado por ti')} /> : null}
          </Row>
        </View>

        <Card tone="raised" style={{ gap: S.sm }}>
          <Row gap={8}>
            <Ionicons name="calendar-outline" size={18} color={C.accent} />
            <T v="h3" style={{ flex: 1 }}>
              {dayLabel(eventDay(e))}
            </T>
            <T v="monoL">{e.start.slice(11)}</T>
          </Row>
          <T v="small">{t('Hora local em {city}', { city: f.venue })}</T>
          {phone ? (
            <T v="small" color={C.text}>
              {t('No teu telemóvel: {time}', {
                time: new Date(phone.ms).toLocaleString(locale, phone.otherDay ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' }),
              })}
            </T>
          ) : null}
        </Card>

        <StatGrid cols={2}>
          <Stat label={t('Buy-in')} value={e.day2 ? '—' : money(e.buyIn, f.currency)} sub={e.day2 ? t('Sem novo buy-in: continua o Dia 1 ({amount})', { amount: money(cost, f.currency) }) : share != null ? t('{pct}% da banca', { pct: Math.round(share * 100) }) : undefined} />
          <Stat label={t('Garantido')} value={e.guarantee ? rawCompactMoney(e.guarantee, f.currency) : '—'} sub={e.guarantee ? undefined : t('Sem garantido publicado')} />
          <Stat label={t('Stack inicial')} value={e.stack ? e.stack.toLocaleString(locale) : '—'} sub={e.stack ? t('fichas') : e.day2 ? t('O teu stack do Dia 1') : t('Não publicado')} />
          <Stat label={t('Níveis')} value={e.levelMinutes ? `${e.levelMinutes} min` : '—'} sub={e.levelMinutes ? t('cada nível') : t('Não publicado')} />
        </StatGrid>

        {e.day2 ? null : (
          <Section title={t('Inscrições')}>
            <Card style={{ gap: S.sm }}>
              {close ? (
                <>
                  <Row gap={8}>
                    <Ionicons name="alarm-outline" size={18} color={C.accent} />
                    <T v="h3" style={{ flex: 1 }}>
                      {t('Late reg até {time}', { time: venueHm(f, close) })}
                    </T>
                  </Row>
                  <T v="small">
                    {late === e.lateRegMin
                      ? t('Hora oficial: {d} depois do início.', { d: hoursLabel(late!) })
                      : t('A hora que marcaste: {d} depois do início.', { d: hoursLabel(late!) })}
                  </T>
                </>
              ) : (
                <T v="small">{t('O organizador ainda não publicou quando fecha o late reg. Marca a hora no plano quando a souberes.')}</T>
              )}
            </Card>
          </Section>
        )}

        <Section title={t('Estrutura')}>
          <Card tone="inset" style={{ gap: S.sm }}>
            {e.stack && e.levelMinutes ? (
              <T v="small" color={C.text}>
                {t('Começas com {stack} fichas e os blinds sobem a cada {min} min.', { stack: e.stack.toLocaleString(locale), min: e.levelMinutes })}
              </T>
            ) : null}
            <T v="small">{t('A tabela de blinds nível a nível ainda não está na app. Pede-a no balcão do torneio.')}</T>
          </Card>
        </Section>

        {rows.length > 1 ? (
          <Section title={rows.every((x) => !x.flight) ? t('Mais datas') : flights.length > 1 ? t('Flights e dias ({n} flights)', { n: flights.length }) : t('Dias do torneio')}>
            <ListGroup>
              {rows.map((x) => {
                const picked = plan.picked.includes(x.id);
                const differs = [x.stack && x.stack !== e.stack ? chips(x.stack) : null, x.levelMinutes && x.levelMinutes !== e.levelMinutes ? `${x.levelMinutes} min` : null].filter(Boolean).join(' · ');
                return (
                  <ListItem
                    key={x.id}
                    title={(flightLabel(x) ?? eventTitle(x)) + (x.id === e.id ? ` · ${t('este')}` : '')}
                    subtitle={[dayLabel(eventDay(x)), x.start.slice(11), differs || null].filter(Boolean).join(' · ')}
                    right={picked ? <Ionicons name="checkmark-circle" size={20} color={C.accent} /> : undefined}
                    onPress={x.id === e.id ? undefined : () => router.setParams({ event: x.id })}
                    chevron={x.id !== e.id}
                  />
                );
              })}
            </ListGroup>
          </Section>
        ) : null}

        <Section title={t('O teu plano')}>
          <View style={{ gap: S.sm }}>
            {on && other ? (
              <Row gap={6}>
                <Ionicons name="warning-outline" size={14} color={C.warn} />
                <T v="small" color={C.warn} style={{ flex: 1 }}>
                  {t('Coincide com {name} às {time}', { name: eventTitle(other) + (other.flight ? ` · ${flightLabel(other)}` : ''), time: other.start.slice(11) })}
                </T>
              </Row>
            ) : null}
            <Button kind={on ? 'secondary' : 'primary'} icon={on ? 'checkmark-circle' : 'add-circle-outline'} title={on ? t('No teu plano') : t('Juntar ao plano')} sub={on ? t('Toca para tirar') : undefined} onPress={toggle} />
            {action ? (
              <Button
                kind="secondary"
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
                onPress={() => start(f, e)}
              />
            ) : null}
          </View>
        </Section>

        {f.own ? null : (
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
        )}
      </ScrollView>
    </>
  );
}
