import React, { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { locale, t } from '@/i18n';
import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { chips } from '@/poker/format';
import type { GameKind } from '@/poker/types';
import { parseDay, playedMs } from '@/store/session-math';
import { uid } from '@/store/store';
import type { Session } from '@/store/types';
import { C } from '@/theme';

import { inputStyle, NumField } from './entry/ContextSheet';
import { StakeFields } from './StakeFields';
import { Button, Chip, Row, T } from './ui';

export function blankSession(kind: GameKind, currency: string, tableSize = 9): Session {
  const mtt = kind === 'mtt';
  return {
    id: uid('s_'),
    kind,
    name: '',
    venue: '',
    currency,
    startedAt: Date.now(),
    breaks: [],
    buyIn: mtt ? 100 : 200,
    entries: 1,
    addOn: 0,
    cashOut: 0,
    sb: mtt ? 100 : 1,
    bb: mtt ? 200 : 2,
    ante: mtt ? 200 : 0,
    anteType: mtt ? 'bb' : 'none',
    level: mtt ? 1 : undefined,
    stage: mtt ? 'early' : undefined,
    tableSize,
    stack: mtt ? 30000 : 200,
    stackLog: [],
    roster: [],
    notes: '',
  };
}

/** Start a live session, or log a past one (`past`). */
export function SessionForm({
  initial,
  past,
  recentNames,
  recentVenues,
  onSubmit,
  submitLabel,
}: {
  initial: Session;
  past?: boolean;
  recentNames: string[];
  recentVenues: string[];
  onSubmit: (s: Session) => void;
  submitLabel: string;
}) {
  const [s, setS] = useState<Session>(initial);
  const initHours = initial.endedAt ? Math.max(1, Math.round(playedMs(initial) / 3600000)) : 4;
  const [hours, setHours] = useState(initHours);
  const initDay = dayStart(initial.endedAt ?? Date.now());
  const [day, setDay] = useState(initDay);
  const [dateText, setDateText] = useState('');
  const set = (p: Partial<Session>) => setS((x) => ({ ...x, ...p }));
  const mtt = s.kind === 'mtt';
  const levels = mtt ? MTT_LEVELS : CASH_LEVELS;
  return (
    <View style={{ gap: 14 }}>
      <Row>
        <Chip big label={t('Torneio')} active={mtt} onPress={() => setS({ ...blankSession('mtt', s.currency, s.tableSize), id: s.id, name: s.name, venue: s.venue })} />
        <Chip big label="Cash game" active={!mtt} onPress={() => setS({ ...blankSession('cash', s.currency, s.tableSize), id: s.id, name: s.name, venue: s.venue })} />
      </Row>
      <View style={{ gap: 6 }}>
        <T v="label">{mtt ? t('Torneio') : t('Jogo')}</T>
        <TextInput value={s.name} onChangeText={(name) => set({ name })} placeholder={mtt ? t('Ex.: Main Event €550') : t('Ex.: NLH 1/2')} placeholderTextColor={C.muted} style={inputStyle} />
        {recentNames.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {recentNames.map((n) => (
              <Chip key={n} label={n} active={s.name === n} onPress={() => set({ name: n })} />
            ))}
          </ScrollView>
        )}
      </View>
      <View style={{ gap: 6 }}>
        <T v="label">{t('Casino / sala')}</T>
        <TextInput value={s.venue} onChangeText={(venue) => set({ venue })} placeholder={t('Ex.: Casino Estoril')} placeholderTextColor={C.muted} style={inputStyle} />
        {recentVenues.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {recentVenues.map((n) => (
              <Chip key={n} label={n} active={s.venue === n} onPress={() => set({ venue: n })} />
            ))}
          </ScrollView>
        )}
      </View>
      <Row gap={10}>
        <NumField label={`Buy-in (${s.currency})`} value={s.buyIn} onChange={(buyIn) => set({ buyIn, stack: mtt ? s.stack : buyIn })} />
        {mtt ? <NumField label={t('Stack inicial')} value={s.stack} onChange={(stack) => set({ stack })} /> : null}
      </Row>
      {!past && (
        <View style={{ gap: 6 }}>
          <T v="label">Blinds</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {levels.map(([sb, bb]) => (
              <Chip key={bb} label={`${chips(sb)}/${chips(bb)}`} active={s.bb === bb && s.sb === sb} onPress={() => set({ sb, bb, ante: mtt ? bb : 0 })} />
            ))}
          </ScrollView>
        </View>
      )}
      {past && (
        <>
          <Row gap={10}>
            <NumField label={mtt ? t('Entradas') : 'Buy-ins'} value={s.entries} onChange={(entries) => set({ entries: Math.max(1, entries) })} />
            <NumField label={mtt ? t('Prémio ({currency})', { currency: s.currency }) : `Cash-out (${s.currency})`} value={s.cashOut} onChange={(cashOut) => set({ cashOut })} />
          </Row>
          <View style={{ gap: 6 }}>
            <T v="label">{t('Quando')}</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {[0, 1, 2, 3, 4, 5, 6].map((k) => {
                const d = dayStart(Date.now()) - k * 86400000;
                return <Chip key={k} label={k === 0 ? t('Hoje') : k === 1 ? t('Ontem') : shortDay(d)} active={day === d} onPress={() => { setDay(d); setDateText(''); }} />;
              })}
            </ScrollView>
            <TextInput
              value={dateText}
              onChangeText={(v) => {
                setDateText(v);
                const d = parseDay(v);
                if (d !== null) setDay(d);
              }}
              placeholder={t('Outra data: dd/mm/aaaa')}
              placeholderTextColor={C.muted}
              keyboardType="numbers-and-punctuation"
              style={inputStyle}
            />
            {day < dayStart(Date.now()) - 6 * 86400000 ? <T v="tiny">{fullDay(day)}</T> : null}
          </View>
          <View style={{ gap: 6 }}>
            <T v="label">{t('Duração')}</T>
            <Row style={{ flexWrap: 'wrap' }} gap={6}>
              {[...new Set([1, 2, 3, 4, 5, 6, 8, 10, 12, initHours])].sort((a, b) => a - b).map((h) => (
                <Chip key={h} label={`${h}h`} active={hours === h} onPress={() => setHours(h)} />
              ))}
            </Row>
          </View>
        </>
      )}
      <StakeFields s={s} onChange={set} expenses={!!past} />
      <Button
        title={submitLabel}
        onPress={() => {
          if (past) {
            // Unchanged date and duration keep the original times (and breaks).
            if (initial.endedAt && day === initDay && hours === initHours) return onSubmit(s);
            const today = dayStart(Date.now());
            const end = day >= today ? Date.now() : day + 23 * 3600000;
            onSubmit({ ...s, startedAt: end - hours * 3600000, endedAt: end, breaks: [], stackLog: [] });
          } else onSubmit({ ...s, startedAt: Date.now(), stackLog: [{ t: Date.now(), stack: s.stack, level: s.level }] });
        }}
      />
    </View>
  );
}

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function shortDay(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

function fullDay(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
