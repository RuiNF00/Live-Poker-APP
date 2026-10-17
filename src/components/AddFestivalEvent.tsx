// "Adicionar torneio" under a festival's schedule: a tournament the schedule
// doesn't have (or a festival with none yet). It joins the plan like any
// other: reminders, one-tap start, the stack and levels if the player knows them.

import React, { useState } from 'react';
import { View } from 'react-native';

import { locale, t } from '@/i18n';
import { LEVEL_LENGTHS } from '@/lib/lock-screen/live-state';
import { festivalSpan, type Festival, type FestivalEvent } from '@/poker/festivals';
import { ownEvent, updatePlan } from '@/store/festival-plan';
import { dayKey } from '@/store/my-festivals';
import { parseClock, parseDay } from '@/store/session-math';
import { uid } from '@/store/store';
import { S } from '@/theme';

import { Button, Card, Chip, ChipRow, Field, NumField, Row, T, tap } from './ui';

const GAMES: FestivalEvent['game'][] = ['NLH', 'PLO', 'Mix'];

/** The festival's days, 'YYYY-MM-DD', for the day chips; empty without dates. */
function daysOf(f: Festival): string[] {
  const span = festivalSpan(f);
  if (!span) return [];
  const out: string[] = [];
  for (let d = new Date(span.from + 'T12:00:00'); dayKey(d.getTime()) <= span.to && out.length < 62; d.setDate(d.getDate() + 1)) out.push(dayKey(d.getTime()));
  return out;
}

function chipDay(day: string) {
  return new Date(day + 'T12:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

export function AddFestivalEvent({ f }: { f: Festival }) {
  const [open, setOpen] = useState(false);
  const [days] = useState(() => daysOf(f));
  const [today] = useState(() => dayKey(Date.now()));
  const [day, setDay] = useState(() => (days.includes(today) ? today : (days[0] ?? '')));
  const [dayText, setDayText] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [game, setGame] = useState<FestivalEvent['game']>('NLH');
  const [buyIn, setBuyIn] = useState(0);
  const [stack, setStack] = useState(0);
  const [levelMinutes, setLevelMinutes] = useState<number | undefined>();
  const mins = parseClock(time);
  const ok = !!name.trim() && !!day && mins !== null;

  if (!open) return <Button title={t('Adicionar torneio')} icon="add" kind="secondary" size="md" lines={2} onPress={() => setOpen(true)} />;
  const save = () => {
    if (!ok) return;
    tap('success');
    const start = `${day}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const id = uid('fe_');
    updatePlan(f.id, (p) => ({
      ...p,
      events: [...(p.events ?? []), ownEvent(id, { name, start, game, buyIn, stack, levelMinutes }, (p.events?.length ?? 0) + 1)],
      // Added to play it: planned straight away (reminders, one-tap start).
      picked: [...p.picked, id],
    }));
    setOpen(false);
    setName('');
    setTime('');
    setBuyIn(0);
    setStack(0);
    setLevelMinutes(undefined);
  };
  return (
    <Card style={{ gap: S.md }}>
      <T v="h3">{t('Adicionar torneio')}</T>
      <Field label={t('Nome')} value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder={t('Ex.: Main Event')} autoFocus />
      {days.length ? (
        <View style={{ gap: 6 }}>
          <T v="label">{t('Dia')}</T>
          <ChipRow style={{ marginHorizontal: -S.md }}>
            {days.map((d) => (
              <Chip key={d} label={chipDay(d)} active={day === d} onPress={() => setDay(d)} />
            ))}
          </ChipRow>
        </View>
      ) : (
        <Field
          label={t('Dia')}
          value={dayText}
          onChangeText={(v) => {
            setDayText(v);
            const d = parseDay(v, Date.now(), true);
            setDay(d === null ? '' : dayKey(d));
          }}
          placeholder="dd/mm/aaaa"
          keyboardType="numbers-and-punctuation"
        />
      )}
      <Field label={t('Hora (local)')} value={time} onChangeText={(v) => setTime(v.slice(0, 5))} placeholder="12:00" keyboardType="numbers-and-punctuation" hint={time && mins === null ? t('Escreve como 20:30') : undefined} />
      <ChipRow>
        {GAMES.map((g) => (
          <Chip key={g} label={g} active={game === g} onPress={() => setGame(g)} />
        ))}
      </ChipRow>
      <Row gap={S.sm} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <NumField label={`Buy-in (${f.currency})`} value={buyIn} onChange={setBuyIn} />
        <NumField label={t('Stack inicial')} value={stack} onChange={setStack} />
      </Row>
      <View style={{ gap: 6 }}>
        <T v="label">{t('Níveis (opcional)')}</T>
        <ChipRow>
          {LEVEL_LENGTHS.map((m) => (
            <Chip key={m} label={`${m} min`} active={levelMinutes === m} onPress={() => setLevelMinutes(levelMinutes === m ? undefined : m)} />
          ))}
        </ChipRow>
      </View>
      <Row gap={S.sm}>
        <Button kind="ghost" size="md" title={t('Cancelar')} style={{ flex: 1 }} onPress={() => setOpen(false)} />
        <Button size="md" title={t('Guardar')} style={{ flex: 1 }} disabled={!ok} haptic={false} onPress={save} />
      </Row>
    </Card>
  );
}
