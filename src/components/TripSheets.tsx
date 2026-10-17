// Sheets for trips: the trip itself (name, dates, currency, exchange rate)
// and one expense (flight, hotel, food, other).

import type Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View } from 'react-native';

import { decimalComma, locale, t } from '@/i18n';
import { useRates } from '@/lib/fx';
import { endOfDay, startOfDay } from '@/store/bankroll-math';
import { rate as fxRate } from '@/store/fx-math';
import { parseDay } from '@/store/session-math';
import { EXPENSE_KINDS } from '@/store/trip-math';
import type { Expense, ExpenseKind, Trip } from '@/store/types';
import { C, F, S } from '@/theme';

import { CURRENCIES, DayPicker } from './BankrollSheets';
import { Button, Chip, ChipRow, Field, NumField, Row, Section, Segmented, T } from './ui';

export const KIND: Record<ExpenseKind, { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  flight: { label: t('Voo'), icon: 'airplane-outline', color: C.info },
  hotel: { label: t('Hotel'), icon: 'bed-outline', color: C.accent },
  food: { label: t('Comida'), icon: 'restaurant-outline', color: C.warn },
  coaching: { label: t('Coaching'), icon: 'school-outline', color: C.check },
  software: { label: 'Software', icon: 'laptop-outline', color: C.textDim },
  other: { label: t('Outros'), icon: 'ellipsis-horizontal', color: C.muted },
};

const dd = (ts: number) => new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

/** "2–18 dez" or "28 nov – 3 dez". */
export function tripDates(x: Pick<Trip, 'from' | 'to'>): string {
  const a = new Date(x.from);
  const b = new Date(x.to);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const month = (d: Date) => d.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  return sameMonth ? `${a.getDate()}–${b.getDate()} ${month(b)}` : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

/** "0,86" or "0.86" → 0.86. */
function parseRate(v: string): number {
  const n = Number(v.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** New trip or edit one. `home` is the player's own currency, offered for the exchange rate. */
export function TripForm({ initial, home, isNew, onSave, onDelete }: { initial: Trip; home: string; isNew: boolean; onSave: (x: Trip) => void; onDelete?: () => void }) {
  const [x, setX] = useState(initial);
  const [fromText, setFromText] = useState(dd(initial.from));
  const [toText, setToText] = useState(dd(initial.to));
  const [rateText, setRateText] = useState(initial.fx?.rate ? String(initial.fx.rate).replace('.', decimalComma ? ',' : '.') : '');
  const set = (p: Partial<Trip>) => setX((c) => ({ ...c, ...p }));
  const fxCur = x.fx?.currency && x.fx.currency !== x.currency ? x.fx.currency : x.currency === home ? CURRENCIES.find((c) => c !== x.currency)! : home;
  const rate = parseRate(rateText);
  const datesOk = x.to >= x.from;
  // Today's ECB rate (cached on the phone), offered with one tap; the bank's own rate may differ.
  const [today] = useState(() => Date.now());
  const ecb = fxRate(useRates(today), x.currency, fxCur, today);
  const ecbText = ecb ? ecb.toLocaleString(locale, { maximumFractionDigits: 4 }) : '';

  const setDay = (which: 'from' | 'to', v: string) => {
    (which === 'from' ? setFromText : setToText)(v);
    const d = parseDay(v, Date.now(), true);
    if (d !== null) set(which === 'from' ? { from: startOfDay(d) } : { to: endOfDay(d) });
  };

  return (
    <View style={{ gap: S.lg }}>
      <Field label={t('Nome')} value={x.name} onChangeText={(name) => set({ name: name.slice(0, 60) })} placeholder={t('Ex.: Bahamas, dezembro')} autoFocus={isNew && !x.name} />
      <Field label={t('Onde')} value={x.venue} onChangeText={(venue) => set({ venue: venue.slice(0, 60) })} placeholder={t('Ex.: Nassau, Bahamas')} />
      <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
        <Field label={t('De')} value={fromText} onChangeText={(v) => setDay('from', v)} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
        <Field label={t('Até')} value={toText} onChangeText={(v) => setDay('to', v)} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
      </Row>
      {!datesOk ? (
        <T v="tiny" color={C.bad}>
          {t('O fim da viagem tem de ser depois do início.')}
        </T>
      ) : (
        <T v="tiny">{t('As sessões que começares nestes dias entram na viagem sozinhas.')}</T>
      )}
      <Section title={t('Moeda da viagem')}>
        <ChipRow>
          {CURRENCIES.map((c) => (
            <Chip key={c} label={c} active={x.currency === c} onPress={() => set({ currency: c })} style={{ minWidth: 48 }} />
          ))}
        </ChipRow>
      </Section>
      <Section title={t('Câmbio')} hint={t('Para despesas pagas em {cur} e para veres o resultado convertido. Usa o câmbio que o banco te cobrou.', { cur: fxCur })}>
        <Row gap={S.sm}>
          <T v="mono" style={{ fontSize: 16 }}>{`1 ${x.currency} =`}</T>
          <Field
            value={rateText}
            onChangeText={(v) => setRateText(v.replace(/[^\d.,]/g, '').slice(0, 10))}
            placeholder="0,00"
            keyboardType="decimal-pad"
            style={{ flex: 1 }}
            inputStyle={{ fontFamily: F.mono, fontVariant: ['tabular-nums'] }}
          />
          <T v="mono" style={{ fontSize: 16 }}>
            {fxCur}
          </T>
        </Row>
        {ecb && ecbText !== rateText ? (
          <Chip icon="sync-outline" label={t('Câmbio do BCE hoje: {rate}', { rate: ecbText })} onPress={() => setRateText(ecbText)} style={{ alignSelf: 'flex-start' }} />
        ) : null}
      </Section>
      <Button
        title={isNew ? t('Criar viagem') : t('Guardar')}
        icon="checkmark"
        disabled={!x.name.trim() || !datesOk}
        onPress={() => onSave({ ...x, name: x.name.trim(), venue: x.venue.trim(), fx: rate > 0 ? { currency: fxCur, rate } : x.fx && x.fx.currency !== x.currency ? { currency: x.fx.currency, rate: 0 } : undefined })}
      />
      {onDelete ? <Button title={t('Apagar viagem')} kind="danger" icon="trash-outline" size="md" onPress={onDelete} /> : null}
    </View>
  );
}

/** New expense or edit one. Paid in the trip's currency or, with a rate, in the other one. */
export function ExpenseForm({ initial, trip, onSave, onDelete }: { initial: Expense; trip: Trip; onSave: (x: Expense) => void; onDelete?: () => void }) {
  const [x, setX] = useState(initial);
  const set = (p: Partial<Expense>) => setX((c) => ({ ...c, ...p }));
  const other = trip.fx && trip.fx.currency !== trip.currency ? trip.fx.currency : null;
  return (
    <View style={{ gap: S.lg }}>
      <ChipRow>
        {EXPENSE_KINDS.map((k) => (
          <Chip key={k} label={KIND[k].label} icon={KIND[k].icon} active={x.kind === k} onPress={() => set({ kind: k })} />
        ))}
      </ChipRow>
      <Row gap={S.sm} style={{ alignItems: 'flex-end' }}>
        <NumField label={t('Valor ({currency})', { currency: x.currency })} value={x.amount} onChange={(amount) => set({ amount: Math.abs(amount) })} autoFocus={!onDelete} />
        {other ? (
          <View style={{ width: 132 }}>
            <Segmented
              options={[
                { key: trip.currency, label: trip.currency },
                { key: other, label: other },
              ]}
              value={x.currency === other ? other : trip.currency}
              onChange={(currency) => set({ currency })}
            />
          </View>
        ) : null}
      </Row>
      {other && x.currency === other && !(trip.fx!.rate > 0) ? (
        <T v="tiny" color={C.warn}>
          {t('Falta o câmbio da viagem: sem ele esta despesa não entra nas contas.')}
        </T>
      ) : null}
      <Section title={t('Quando')}>
        <DayPicker value={x.at} onChange={(d) => set({ at: d + 12 * 3600000 })} />
      </Section>
      <Field label={t('Nota')} value={x.note} onChangeText={(note) => set({ note: note.slice(0, 80) })} placeholder={x.kind === 'flight' ? t('Ex.: Lisboa–Nassau') : x.kind === 'hotel' ? t('Ex.: 7 noites') : ''} />
      <Button title={t('Guardar despesa')} icon="checkmark" disabled={!(x.amount > 0)} onPress={() => onSave(x)} />
      {onDelete ? <Button title={t('Apagar')} kind="danger" icon="trash-outline" size="md" onPress={onDelete} /> : null}
    </View>
  );
}
