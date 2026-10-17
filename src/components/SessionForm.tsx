import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { locale, t } from '@/i18n';
import { isMtt } from '@/billing/onboarding';
import { CASH_LEVELS, gameForPlays, MTT_LEVELS } from '@/poker/factory';
import { chips } from '@/poker/format';
import type { GameKind } from '@/poker/types';
import { lastPlayed, lastTimeAt, parseClock, parseDay, parseDuration, playedMs } from '@/store/session-math';
import { uid, useStore } from '@/store/store';
import type { Bankroll, Session } from '@/store/types';
import { roundedClock, weeklyMatch, type WeeklyTournament } from '@/store/weekly';
import { countryOfVenue } from '@/tax/countries';
import { S } from '@/theme';

import { MindAfter, MindBefore } from './MindCheckIn';
import { StakeFields } from './StakeFields';
import { TaxFields } from './TaxFields';
import { Button, Card, Chip, ChipRow, Field, NumField, Row, Section, Segmented, T, ToggleItem } from './ui';

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

/** Usual tournament buy-in for each first-run answer, a starting point to edit. */
const MTT_BUY_IN: Record<string, number> = { mtt1: 250, mtt2: 1100, mtt3: 5000 };

/**
 * The very first session, from the first-run answers: tournament or cash and the
 * stakes, with a 100-big-blind buy-in for cash. Null when nothing was answered.
 */
export function firstSession(plays: string | null | undefined, currency: string, tableSize = 9): Session | null {
  const g = gameForPlays(plays, currency);
  if (!g || !plays) return null;
  if (isMtt(plays)) {
    const s = blankSession('mtt', currency, tableSize);
    return { ...s, buyIn: MTT_BUY_IN[plays] ?? s.buyIn };
  }
  const buyIn = g.bb * 100;
  return { ...blankSession('cash', currency, tableSize), sb: g.sb, bb: g.bb, buyIn, stack: buyIn };
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
  today = [],
  weekly,
}: {
  initial: Session;
  /** Festival tournaments starting today: a chip fills the form with that event (buy-in, stack, levels). */
  today?: { key: string; label: string; fill: Partial<Session> }[];
  past?: boolean;
  /** Where the session can count; a choice only shows with two or more. */
  bankrolls?: Bankroll[];
  recentNames: string[];
  recentVenues: string[];
  onSubmit: (s: Session) => void;
  submitLabel: string;
  /** The player's weekly tournaments: "Repetir todas as semanas" on a live tournament, saved when it starts. */
  weekly?: { list: WeeklyTournament[]; onSave: (s: Session, time: string) => void; onStop: (id: string) => void };
  /** The caller draws the submit button (a bar pinned above the tab bar) and calls this; the form then leaves it out. */
  submitRef?: React.RefObject<(() => void) | null>;
}) {
  const [s0, setS] = useState<Session>(initial);
  const { sessions } = useStore();
  // A venue played before brings its country (for the tax report).
  const s = s0.country !== undefined || !s0.venue ? s0 : { ...s0, country: countryOfVenue(s0.venue, sessions) };
  // Duration in minutes (4h30 is common live); start time as the player typed it.
  const initMins = initial.endedAt ? Math.max(15, Math.round(playedMs(initial) / 60000)) : 240;
  const [mins, setMins] = useState(initMins);
  const [minsText, setMinsText] = useState('');
  const initDay = dayStart(initial.endedAt ? initial.startedAt : Date.now());
  const [day, setDay] = useState(initDay);
  const [dateText, setDateText] = useState('');
  const initTime = initial.endedAt ? clockOf(initial.startedAt) : '';
  const [timeText, setTimeText] = useState(initTime);
  const startMin = parseClock(timeText);
  const [mindOpen, setMindOpen] = useState(!!initial.mind);
  const [repeat, setRepeat] = useState(false);
  const [repeatTime, setRepeatTime] = useState(() => roundedClock());
  const repeatMin = parseClock(repeatTime);
  const set = (p: Partial<Session>) => setS((x) => ({ ...x, ...p }));
  const mtt = s.kind === 'mtt';
  const levels = mtt ? MTT_LEVELS : CASH_LEVELS;
  // A new past session: switching kind brings the last game of that kind (it was the other kind's).
  const fresh = past && !initial.endedAt;
  const switchKind = (k: GameKind) =>
    setS({ ...blankSession(k, s.currency, s.tableSize), id: s.id, name: s.name, venue: s.venue, format: s.format, bankrollId: s.bankrollId, country: s0.country, ...(fresh ? lastPlayed(s.currency, sessions, k) : {}) });
  const online = s.format === 'online';
  const submit = () => {
    if (past) {
      // Unchanged date, start and duration keep the original times (and breaks).
      if (initial.endedAt && day === initDay && mins === initMins && timeText === initTime) return onSubmit(s);
      let start: number;
      if (startMin !== null) start = day + startMin * 60000;
      else {
        // No start time: it ended now (today) or late that evening.
        const end = day >= dayStart(Date.now()) ? Date.now() : day + 23 * 3600000;
        start = end - mins * 60000;
      }
      onSubmit({ ...s, startedAt: start, endedAt: start + mins * 60000, breaks: [], stackLog: [] });
    } else {
      if (weekly && repeat && repeatMin !== null && s.kind === 'mtt' && s.name.trim() && !weeklyMatch(weekly.list, s)) {
        weekly.onSave(s, `${String(Math.floor(repeatMin / 60)).padStart(2, '0')}:${String(repeatMin % 60).padStart(2, '0')}`);
      }
      onSubmit({ ...s, startedAt: Date.now(), stackLog: [{ t: Date.now(), stack: s.stack, level: s.level }] });
    }
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
      {/* Past: the result first, so it sits above the keyboard that opens on it. */}
      {past && (
        <Card style={{ gap: S.lg }}>
          <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
            <NumField label={mtt ? t('Entradas') : 'Buy-ins'} value={s.entries} onChange={(entries) => set({ entries: Math.max(1, entries) })} selectOnFocus />
            <NumField label={mtt ? t('Prémio ({currency})', { currency: s.currency }) : `Cash-out (${s.currency})`} value={s.cashOut} onChange={(cashOut) => set({ cashOut })} autoFocus={fresh} selectOnFocus />
          </Row>
          <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
            <NumField label={mtt ? t('Add-ons ({currency})', { currency: s.currency }) : t('Top-ups ({currency})', { currency: s.currency })} value={s.addOn} onChange={(addOn) => set({ addOn })} selectOnFocus />
            <NumField label={t('Gorjetas ({currency})', { currency: s.currency })} value={s.tips ?? 0} onChange={(tips) => set({ tips: tips || undefined })} selectOnFocus />
          </Row>
          <Row>
            <NumField label={t('Mãos jogadas (opcional)')} value={s.handsDealt ?? 0} onChange={(handsDealt) => set({ handsDealt: handsDealt || undefined })} />
          </Row>
        </Card>
      )}
      <Card style={{ gap: S.lg }}>
        <View style={{ gap: S.sm }}>
          <Field label={mtt ? t('Torneio') : t('Jogo')} value={s.name} onChangeText={(name) => set({ name })} placeholder={mtt ? t('Ex.: Main Event €550') : t('Ex.: NLH 1/2')} />
          {mtt && !past && today.length > 0 && (
            <ChipRow style={{ marginHorizontal: -S.lg }}>
              {today.map((x) => (
                <Chip key={x.key} label={x.label} active={s.name === x.fill.name && s.buyIn === x.fill.buyIn} onPress={() => set(x.fill)} />
              ))}
            </ChipRow>
          )}
          {recentNames.length > 0 && (
            <ChipRow style={{ marginHorizontal: -S.lg }}>
              {recentNames.map((n) => (
                <Chip key={n} label={n} active={s.name === n} onPress={() => set(lastTimeAt(n, s, sessions))} />
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
          <NumField label={`Buy-in (${s.currency})`} value={s.buyIn} onChange={(buyIn) => set({ buyIn, stack: mtt ? s.stack : buyIn })} selectOnFocus={past} />
          {mtt ? <NumField label={t('Stack inicial')} value={s.stack} onChange={(stack) => set({ stack })} /> : null}
        </Row>
      </Card>
      {mtt && !past && weekly ? <Repeat weekly={weekly} s={s} on={repeat} setOn={setRepeat} time={repeatTime} setTime={setRepeatTime} /> : null}
      {(!past || !mtt) && (
        <Section title={past ? 'Stakes' : 'Blinds'}>
          <ChipRow>
            {levels.map(([sb, bb]) => (
              <Chip key={`${sb}/${bb}`} label={`${chips(sb)}/${chips(bb)}`} active={s.bb === bb && s.sb === sb} onPress={() => set({ sb, bb, ante: mtt ? bb : 0 })} />
            ))}
          </ChipRow>
        </Section>
      )}
      {past && (
        <>
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
          <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
            <Field
              label={t('Começou às')}
              style={{ flex: 1 }}
              value={timeText}
              onChangeText={(v) => setTimeText(v.slice(0, 5))}
              placeholder="20:00"
              keyboardType="numbers-and-punctuation"
              hint={timeText && startMin === null ? t('Escreve como 20:30') : undefined}
            />
            <Field
              label={t('Outra duração')}
              style={{ flex: 1 }}
              value={minsText}
              onChangeText={(v) => {
                setMinsText(v.slice(0, 5));
                const m = parseDuration(v);
                if (m !== null) setMins(m);
              }}
              placeholder="4h30"
              keyboardType="numbers-and-punctuation"
            />
          </Row>
          <Section title={t('Duração')}>
            <ChipRow>
              {[...new Set([60, 120, 180, 240, 300, 360, 480, 600, 720, mins])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <Chip
                    key={m}
                    label={durationLabel(m)}
                    active={mins === m}
                    onPress={() => {
                      setMins(m);
                      setMinsText('');
                    }}
                  />
                ))}
            </ChipRow>
          </Section>
        </>
      )}
      <StakeFields s={s} onChange={set} expenses={!!past} />
      {past && <TaxFields s={s} onChange={set} />}
      {!past ? null : mindOpen ? (
        <Section title={t('Diário mental')}>
          <MindBefore value={s.mind} onChange={(mind) => set({ mind })} />
          <MindAfter value={s.mind} onChange={(mind) => set({ mind })} />
        </Section>
      ) : (
        <Button kind="ghost" size="sm" icon="add" title={t('Diário mental')} onPress={() => setMindOpen(true)} style={{ alignSelf: 'flex-start' }} />
      )}
      {submitRef ? null : <Button title={submitLabel} icon={past ? 'checkmark' : 'play'} onPress={submit} />}
    </View>
  );
}

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function clockOf(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function durationLabel(m: number): string {
  return m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`;
}

function shortDay(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

function fullDay(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "Repetir todas as semanas": on, the tournament is in today's chips every week on this day; off on one already saved stops it. */
function Repeat({ weekly, s, on, setOn, time, setTime }: { weekly: NonNullable<Parameters<typeof SessionForm>[0]['weekly']>; s: Session; on: boolean; setOn: (v: boolean) => void; time: string; setTime: (v: string) => void }) {
  const match = weeklyMatch(weekly.list, s);
  const day = new Date().toLocaleDateString(locale, { weekday: 'long' });
  const Day = day.charAt(0).toUpperCase() + day.slice(1);
  return (
    <Card padded={false}>
      <ToggleItem
        icon="repeat"
        title={t('Repetir todas as semanas')}
        subtitle={match ? t('{day} às {time}, pronto a começar com um toque', { day: Day, time: match.time }) : t('{day} de cada semana, pronto a começar com um toque', { day: Day })}
        value={!!match || on}
        onChange={(v) => (match && !v ? weekly.onStop(match.id) : setOn(v))}
      />
      {on && !match ? (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md }}>
          <Field label={t('Começa às')} value={time} onChangeText={(v) => setTime(v.slice(0, 5))} placeholder="21:00" keyboardType="numbers-and-punctuation" hint={parseClock(time) === null ? t('Escreve como 20:30') : undefined} />
        </View>
      ) : null}
    </Card>
  );
}
