// One festival in a list (Sessão tab, all festivals): its name, where, and how
// many tournaments or when. Opens the planner.

import { router } from 'expo-router';
import React from 'react';

import { locale, t } from '@/i18n';
import { festivalSpan, type Festival } from '@/poker/festivals';
import { festivalName, useFestivalPlan } from '@/store/festival-plan';
import { C } from '@/theme';

import { ListItem } from './ui';

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
      subtitle={[f.own ? f.venue : t(f.venue), when].filter(Boolean).join(' · ')}
      chevron
      onPress={() => router.push({ pathname: '/festival', params: { id: f.id } })}
    />
  );
}
