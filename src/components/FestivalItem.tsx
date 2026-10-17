// One festival in a list (Sessão tab, all festivals): its name, where, and how
// many tournaments or when. Opens the planner.

import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { locale, t } from '@/i18n';
import { eventTitle, festivalSpan, type Festival } from '@/poker/festivals';
import { money } from '@/poker/format';
import { festivalName, plannedNow, useFestivalPlan, useFestivalPlans } from '@/store/festival-plan';
import { dayOf } from '@/store/multi-day';
import { useStore } from '@/store/store';
import { C } from '@/theme';

import { ListItem } from './ui';
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
  const when = f.events.length ? t('{n} torneios', { n: new Set(f.events.map((e) => e.number)).size }) : span ? spanLabel(span.from, span.to) : t('Datas a confirmar');
  return (
    <ListItem
      icon={f.own ? 'flag-outline' : 'calendar-outline'}
      iconColor={C.accent}
      title={festivalName(f, plan)}
      numberOfLines={0}
      subtitle={[f.own ? f.venue : t(f.venue), when].filter(Boolean).join(' · ')}
      chevron
      onPress={() => router.push({ pathname: '/festival', params: { id: f.id } })}
    />
  );
}

/** The Sessão tab's shortcut to the tournament planned for now, in any festival: one tap starts it, filled in. */
export function PlannedNow({ festivals }: { festivals: Festival[] }) {
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
  return (
    <ListItem
      icon="play"
      iconColor={C.accent}
      title={p.action.kind === 'resume' ? t('Começar Dia {n}', { n: dayOf(p.action.session) + 1 }) + ' · ' + name : t('Começar: {name}', { name })}
      numberOfLines={0}
      subtitle={[t('Às {time}', { time: p.e.start.slice(11) }), p.e.day2 ? null : money(p.e.buyIn, f.currency)].filter(Boolean).join(' · ')}
      chevron
      onPress={() => start(f, p.e)}
    />
  );
}
