// In "Terminar sessão" for a festival tournament: what comes next, so busting
// doesn't mean opening the planner. A re-entry while late reg is open, or the
// next planned event with one tap to start it. Nothing when the plan has neither.
// After bagging, under "Por continuar": a reminder for the Day 2 it goes on to.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';

import { t } from '@/i18n';
import { eventDay, type Festival, type FestivalEvent } from '@/poker/festivals';
import { money } from '@/poker/format';
import { shortDay } from '@/share/festival-plan';
import { syncFestivalReminders } from '@/lib/festival-reminders';
import { kindOn } from '@/lib/notify-policy';
import { afterSession, getPlan, REMIND_BEFORE_MIN, updatePlan, useFestivalPlans, venueHm, type AfterSession } from '@/store/festival-plan';
import { dayOf } from '@/store/multi-day';
import { useFestivals } from '@/store/my-festivals';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, S } from '@/theme';

import { useNotifySoftAsk } from './NotifySoftAsk';
import { sessionName } from './useStartEvent';
import { Button, Row, T, ToggleItem } from './ui';

/** "Próximo do plano: X às 18:00", with the day when it isn't today (venue time). */
export function nextLine(f: Festival, e: FestivalEvent, now = Date.now()): string {
  const time = e.start.slice(11, 16);
  const event = sessionName(e);
  return eventDay(e) === venueDay(f, now) ? t('Próximo do plano: {event} às {time}', { event, time }) : t('Próximo do plano: {event}, {day} às {time}', { event, day: shortDay(eventDay(e)), time });
}

function venueDay(f: Festival, ms: number): string {
  return new Date(ms + f.utcOffset * 60_000).toISOString().slice(0, 10);
}

export function AfterFestivalSession({ s, after, prize, onReenter, onNext }: { s: Session; after: AfterSession; prize: number; onReenter: () => void; onNext: (e: FestivalEvent) => void }) {
  const { f, next } = after;
  // A prize means it didn't end in a bust: nothing to re-enter.
  const reenter = !!after.reenterUntil && !prize;
  if (!reenter && !next) return null;
  return (
    <>
      {reenter ? (
        <Button
          kind="secondary"
          size="md"
          icon="refresh"
          title={t('Re-entrar · {amount}', { amount: money(s.buyIn, s.currency) })}
          sub={t('Late reg aberto até às {time}', { time: venueHm(f, after.reenterUntil!) })}
          onPress={onReenter}
        />
      ) : null}
      {next ? (
        next.now ? (
          <Button kind="secondary" size="md" icon="play" title={nextLine(f, next.e)} sub={t('Guarda esta e começa já')} onPress={() => onNext(next.e)} />
        ) : (
          <Row gap={6} style={{ paddingHorizontal: S.xs }}>
            <Ionicons name="calendar-outline" size={14} color={C.textDim} />
            <T v="small" style={{ flex: 1 }}>
              {nextLine(f, next.e)}
            </T>
          </Row>
        )
      ) : null}
    </>
  );
}

/** "Dia 2 a {data}: lembrar-me" under a bagged festival session: puts that Day 2 in the plan, so its reminder comes. */
export function Day2Remind({ b }: { b: Session }) {
  const festivals = useFestivals();
  const plans = useFestivalPlans();
  const { sessions, settings } = useStore();
  const [softAsk, askNotify] = useNotifySoftAsk();
  const after = useMemo(() => afterSession(festivals, plans, sessions, b), [festivals, plans, sessions, b]);
  const d2 = after?.day2;
  if (!after || !d2) return null;
  const { f } = after;
  return (
    <>
      <ToggleItem
        icon="alarm-outline"
        title={t('Dia {n} a {date}: lembrar-me', { n: dayOf(b) + 1, date: `${shortDay(eventDay(d2.e))} ${d2.e.start.slice(11, 16)}` })}
        subtitle={t('Avisamos-te {n} min antes.', { n: REMIND_BEFORE_MIN })}
        value={d2.planned}
        onChange={async (on) => {
          updatePlan(f.id, (p) => ({ ...p, picked: [...p.picked.filter((x) => x !== d2.e.id), ...(on ? [d2.e.id] : [])] }));
          if (on) await askNotify({ where: 'festival', title: t('Avisamos-te antes do Dia {n}', { n: dayOf(b) + 1 }), preview: { title: t('Começa daqui a {n} min', { n: REMIND_BEFORE_MIN }), body: sessionName(d2.e) } });
          void syncFestivalReminders(f, getPlan(f.id), kindOn(settings, 'festival'));
        }}
      />
      {softAsk}
    </>
  );
}
