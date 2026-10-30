// One festival in a list (Sessão tab, all festivals): its name, where, and how
// many tournaments or when. Opens the planner.

import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { locale, t } from '@/i18n';
import { eventTitle, festivalSpan, type Festival } from '@/poker/festivals';
import { money } from '@/poker/format';
import { startWhen } from '@/store/festival-event';
import { festivalName, plannedNow, useFestivalPlan, useFestivalPlans } from '@/store/festival-plan';
import { dayOf } from '@/store/multi-day';
import { useStore } from '@/store/store';
import { C } from '@/theme';

import { ListGroup, ListItem } from './ui';
import { useStartEvent } from './useStartEvent';

/** "22–30 jan" or "15 jan – 7 mar" from 'YYYY-MM-DD' days. */
export function spanLabel(from: string, to: string): string {
  const d = (x: string) => new Date(x + 'T12:00:00');
  const [a, b] = [d(from), d(to)];
  const month = (x: Date) => x.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? `${a.getDate()}–${b.getDate()} ${month(b)}` : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

export function FestivalItem({ f }: { f: Festival }) {
  const plan = useFestivalPlan(f.id);
  const span = festivalSpan(f);
  const name = festivalName(f, plan);
  const venue = f.own ? f.venue : t(f.venue);
  // Every row the same shape: the days, then how many tournaments; the place only when the name doesn't already say it.
  const count = f.events.length ? t('{n} torneios', { n: new Set(f.events.map((e) => e.number)).size }) : '';
  const when = span ? spanLabel(span.from, span.to) : count ? '' : t('Datas a confirmar');
  return (
    <ListItem
      icon={f.own ? 'flag-outline' : 'calendar-outline'}
      iconColor={C.accent}
      title={name}
      numberOfLines={0}
      subtitle={[venue && !name.toLowerCase().includes(venue.toLowerCase()) ? venue : '', when, count].filter(Boolean).join(' · ')}
      chevron
      onPress={() => router.push({ pathname: '/festival', params: { id: f.id } })}
    />
  );
}

/**
 * The shortcut to the tournament planned for now, in any festival: one tap starts it, filled in.
 * In the Sessão tab's list; `group` puts it in its own list (the Resumo, where nothing else goes with it).
 */
export function PlannedNow({ festivals, group }: { festivals: Festival[]; group?: boolean }) {
  const plans = useFestivalPlans();
  const { sessions } = useStore();
  const start = useStartEvent();
  // The tab stays mounted: look again every minute so the row shows up 2 h before the start.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);
  const hit = festivals.map((f) => ({ f, p: plans[f.id] ? plannedNow(f, plans[f.id], sessions, now) : null })).find((x) => x.p);
  if (!hit?.p) return null;
  const { f, p } = hit;
  const name = eventTitle(p.e) + (p.e.flight ? ` · Flight ${p.e.flight}` : '');
  // The phone's clock when it isn't the festival's (still at home): «Às 16:00» would be an hour off.
  const at = startWhen(f, p.e, locale, now);
  const row = (
    <ListItem
      icon="play"
      iconColor={C.accent}
      title={p.action.kind === 'resume' ? t('Começar Dia {n}', { n: dayOf(p.action.session) + 1 }) + ' · ' + name : t('Começar: {name}', { name })}
      numberOfLines={0}
      subtitle={[at, p.e.day2 ? null : money(p.e.buyIn, f.currency)].filter(Boolean).join(' · ')}
      chevron
      onPress={() => start(f, p.e)}
    />
  );
  return group ? <ListGroup>{row}</ListGroup> : row;
}
