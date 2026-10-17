import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { locale, t } from '@/i18n';
import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { chips } from '@/poker/format';
import type { GameKind } from '@/poker/types';
import { parseDay, playedMs } from '@/store/session-math';
import { uid, useStore } from '@/store/store';
import type { Bankroll, Session } from '@/store/types';
import { countryOfVenue } from '@/tax/countries';
import { S } from '@/theme';

import { StakeFields } from './StakeFields';
import { TaxFields } from './TaxFields';
import { Button, Card, Chip, ChipRow, Field, NumField, Row, Section, Segmented, T } from './ui';

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
  bankrolls = [],
  submitRef,
}: {
  initial: Session;
  past?: boolean;
  /** Where the session can count; a choice only shows with two or more. */
  bankrolls?: Bankroll[];
  recentNames: string[];
  recentVenues: string[];
  onSubmit: (s: Session) => void;
  submitLabel: string;
  /** The caller draws the submit button (a bar pinned above the tab bar) and calls this; the form then leaves it out. */
  submitRef?: React.RefObject<(() => void) | null>;
}) {
  const [s0, setS] = useState<Session>(initial);
  const { sessions } = useStore();
  // A venue played before brings its country (for the tax report).
  const s = s0.country !== undefined || !s0.venue ? s0 : { ...s0, country: countryOfVenue(s0.venue, sessions) };
  const initHours = initial.endedAt ? Math.max(1, Math.round(playedMs(initial) / 3600000)) : 4;
  const [hours, setHours] = useState(initHours);
  const initDay = dayStart(initial.endedAt ?? Date.now());
  const [day, setDay] = useState(initDay);
  const [dateText, setDateText] = useState('');
  const set = (p: Partial<Session>) => setS((x) => ({ ...x, ...p }));
  const mtt = s.kind === 'mtt';
  const levels = mtt ? MTT_LEVELS : CASH_LEVELS;
  const switchKind = (k: GameKind) => setS({ ...blankSession(k, s.currency, s.tableSize), id: s.id, name: s.name, venue: s.venue, format: s.format, bankrollId: s.bankrollId, country: s0.country });
  const online = s.format === 'online';
  const submit = () => {
    if (past) {
      // Unchanged date and duration keep the original times (and breaks).
      if (initial.endedAt && day === initDay && hours === initHours) return onSubmit(s);
      const today = dayStart(Date.now());
      const end = day >= today ? Date.now() : day + 23 * 3600000;
      onSubmit({ ...s, startedAt: end - hours * 3600000, endedAt: end, breaks: [], stackLog: [] });
    } else onSubmit({ ...s, startedAt: Date.now(), stackLog: [{ t: Date.now(), stack: s.stack, level: s.level }] });
  };
  useEffect(() => {
    if (submitRef) submitRef.current = submit;
  });
  return (
    <View style={{ gap: S.lg }}>
      <Segmented
        options={[
          { key: 'mtt', label: t('Torneio') },
          { key: 'cash', label: 'Cash game' },
        ]}
        value={s.kind}
        onChange={(k) => k !== s.kind && switchKind(k)}
      />
      <Segmented
        size="sm"
        options={[
          { key: 'live', label: 'Live' },
          { key: 'online', label: 'Online' },
        ]}
        value={online ? 'online' : 'live'}
        onChange={(f) => set({ format: f === 'online' ? 'online' : undefined })}
      />
      {bankrolls.length > 1 && (
        <Section title="Bankroll">
          <ChipRow>
            {bankrolls.map((b) => (
              <Chip
                key={b.id}
                label={`${b.name} · ${b.currency}`}
                active={(s.bankrollId ? s.bankrollId === b.id : b.currency === s.currency && bankrolls.find((x) => x.currency === s.currency)?.id === b.id)}
                onPress={() => set({ bankrollId: b.id, currency: b.currency })}
              />
            ))}
          </ChipRow>
        </Section>
      )}
      <Card style={{ gap: S.lg }}>
        <View style={{ gap: S.sm }}>
          <Field label={mtt ? t('Torneio') : t('Jogo')} value={s.name} onChangeText={(name) => set({ name })} placeholder={mtt ? t('Ex.: Main Event €550') : t('Ex.: NLH 1/2')} />
          {recentNames.length > 0 && (
            <ChipRow style={{ marginHorizontal: -S.lg }}>
              {recentNames.map((n) => (
                <Chip key={n} label={n} active={s.name === n} onPress={() => set({ name: n })} />
              ))}
            </ChipRow>
          )}
        </View>
        <View style={{ gap: S.sm }}>
          <Field label={online ? t('Sala online') : t('Casino / sala')} value={s.venue} onChangeText={(venue) => set({ venue })} placeholder={online ? t('Ex.: a tua sala online') : t('Ex.: Casino da cidade')} />
          {recentVenues.length > 0 && (
            <ChipRow style={{ marginHorizontal: -S.lg }}>
              {recentVenues.map((n) => (
                <Chip key={n} label={n} active={s.venue === n} onPress={() => set({ venue: n })} />
              ))}
            </ChipRow>
          )}
        </View>
        <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
          <NumField label={`Buy-in (${s.currency})`} value={s.buyIn} onChange={(buyIn) => set({ buyIn, stack: mtt ? s.stack : buyIn })} />
          {mtt ? <NumField label={t('Stack inicial')} value={s.stack} onChange={(stack) => set({ stack })} /> : null}
        </Row>
      </Card>
      {(!past || !mtt) && (
        <Section title={past ? 'Stakes' : 'Blinds'}>
          <ChipRow>
            {levels.map(([sb, bb]) => (
              <Chip key={bb} label={`${chips(sb)}/${chips(bb)}`} active={s.bb === bb && s.sb === sb} onPress={() => set({ sb, bb, ante: mtt ? bb : 0 })} />
            ))}
          </ChipRow>
        </Section>
      )}
      {past && (
        <>
          <Card style={{ gap: S.lg }}>
            <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
              <NumField label={mtt ? t('Entradas') : 'Buy-ins'} value={s.entries} onChange={(entries) => set({ entries: Math.max(1, entries) })} />
              <NumField label={mtt ? t('Prémio ({currency})', { currency: s.currency }) : `Cash-out (${s.currency})`} value={s.cashOut} onChange={(cashOut) => set({ cashOut })} />
            </Row>
          </Card>
          <Section title={t('Quando')}>
            <ChipRow>
              {[0, 1, 2, 3, 4, 5, 6].map((k) => {
                const d = dayStart(Date.now()) - k * 86400000;
                return (
                  <Chip
                    key={k}
                    label={k === 0 ? t('Hoje') : k === 1 ? t('Ontem') : shortDay(d)}
                    active={day === d}
                    onPress={() => {
                      setDay(d);
                      setDateText('');
                    }}
                  />
                );
              })}
            </ChipRow>
            <Field
              value={dateText}
              onChangeText={(v) => {
                setDateText(v);
                const d = parseDay(v);
                if (d !== null) setDay(d);
              }}
              placeholder={t('Outra data: dd/mm/aaaa')}
              keyboardType="numbers-and-punctuation"
            />
            {day < dayStart(Date.now()) - 6 * 86400000 ? <T v="tiny">{fullDay(day)}</T> : null}
          </Section>
          <Section title={t('Duração')}>
            <ChipRow>
              {[...new Set([1, 2, 3, 4, 5, 6, 8, 10, 12, initHours])]
                .sort((a, b) => a - b)
                .map((h) => (
                  <Chip key={h} label={`${h}h`} active={hours === h} onPress={() => setHours(h)} />
                ))}
            </ChipRow>
          </Section>
        </>
      )}
      <StakeFields s={s} onChange={set} expenses={!!past} />
      {past && <TaxFields s={s} onChange={set} />}
      {submitRef ? null : <Button title={submitLabel} icon={past ? 'checkmark' : 'play'} onPress={submit} />}
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
