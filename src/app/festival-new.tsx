// "Adicionar o meu festival": a series we don't ship. Name, city, dates and
// currency; it then sits in the planner and makes a trip like the others.
// With ?id=, edits (or deletes) one the player added.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, useWindowDimensions, View } from 'react-native';

import { CURRENCIES } from '@/components/BankrollSheets';
import { Button, Chip, ChipRow, Field, Row, Section, T, tap } from '@/components/ui';
import { locale, t } from '@/i18n';
import { syncFestivalReminders } from '@/lib/festival-reminders';
import { useOffers } from '@/store/action-offer';
import { getPlan } from '@/store/festival-plan';
import { dayKey, deleteOwnFestival, festivalById, ownFestival, ownFestivalOk, saveOwnFestival, type OwnFestivalInput } from '@/store/my-festivals';
import { parseDay } from '@/store/session-math';
import { uid, useStore } from '@/store/store';
import { C, S } from '@/theme';

/** "Malta, novembro 2026" from the city and the first day; just the city before there's a day. */
function autoName(city: string, from: string): string {
  const c = city.trim();
  if (!c || !from) return c;
  const d = new Date(from + 'T12:00:00');
  return `${c}, ${d.toLocaleDateString(locale, { month: 'long' })} ${d.getFullYear()}`;
}

const dd = (day: string) => (day ? new Date(day + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function FestivalNewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { fontScale } = useWindowDimensions();
  const { settings, trips } = useStore();
  const offers = useOffers();
  const old = festivalById(id);
  const editing = !!old?.own;
  // Buy-ins, sessions, sold action or trip expenses already in its currency: changing it would relabel them, so it stays.
  const plan = old?.own ? getPlan(old.id) : undefined;
  const currencyLocked =
    !!old?.own &&
    (!!plan?.events?.length || Object.keys(plan?.sessions ?? {}).length > 0 || offers.some((o) => o.festivalId === old.id) || trips.some((tr) => tr.festivalId === old.id && tr.expenses.length > 0));
  const [x, setX] = useState<OwnFestivalInput>(() =>
    old?.own && old.dates ? { name: old.name, city: old.venue, currency: old.currency, from: old.dates.from, to: old.dates.to } : { name: '', city: '', currency: settings.currency, from: '', to: '' },
  );
  const [fromText, setFromText] = useState(dd(x.from));
  const [toText, setToText] = useState(dd(x.to));
  // Until the player types a name, it follows the city and the first day: "Malta, novembro 2026".
  const [named, setNamed] = useState(editing);
  const [autoTo, setAutoTo] = useState(false);
  const set = (p: Partial<OwnFestivalInput>) =>
    setX((c) => {
      const n = { ...c, ...p };
      return named || p.name !== undefined ? n : { ...n, name: autoName(n.city, n.from) };
    });

  const setDay = (which: 'from' | 'to', v: string) => {
    (which === 'from' ? setFromText : setToText)(v);
    const d = parseDay(v, Date.now(), true);
    if (which === 'to') setAutoTo(false);
    // A first day with no last day typed: a week, which the player can change.
    if (which === 'from' && d !== null && (!x.to || autoTo)) {
      setAutoTo(true);
      const week = new Date(d);
      week.setDate(week.getDate() + 7);
      setToText(dd(dayKey(week.getTime())));
      set({ from: dayKey(d), to: dayKey(week.getTime()) });
      return;
    }
    set({ [which]: d === null ? '' : dayKey(d) });
  };

  const save = () => {
    tap('success');
    const made = ownFestival(old?.own ? old.id : uid('fx_'), x);
    // Same days: keep the offset it had, so its reminders don't move.
    const f = old?.own && old.dates?.from === x.from && old.dates?.to === x.to ? { ...made, utcOffset: old.utcOffset } : made;
    saveOwnFestival(f);
    if (editing) router.back();
    else router.replace({ pathname: '/festival', params: { id: f.id } });
  };

  const remove = () => {
    const go = () => {
      if (old) {
        // Its reminders go with it.
        void syncFestivalReminders(old, getPlan(old.id), false);
        deleteOwnFestival(old.id);
      }
      router.dismissTo('/festivals');
    };
    if (Platform.OS === 'web') go();
    else Alert.alert(t('Apagar este festival?'), t('A viagem que criaste para ele fica, com as sessões e as despesas.'), [{ text: t('Cancelar'), style: 'cancel' }, { text: t('Apagar'), style: 'destructive', onPress: go }]);
  };

  const datesBad = !!x.from && !!x.to && x.to < x.from;
  return (
    <>
      <Stack.Screen options={{ title: editing ? t('Editar festival') : t('Adicionar o meu festival') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Field label={t('Cidade')} value={x.city} onChangeText={(city) => set({ city: city.slice(0, 40) })} placeholder={t('Ex.: St. Julian’s')} autoFocus={!editing} />
        {/* Side by side; under large text each date gets its own line instead of being cut. */}
        <Row gap={S.sm} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Field label={t('De')} value={fromText} onChangeText={(v) => setDay('from', v)} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" style={{ flexGrow: 1, flexBasis: 150 * fontScale }} />
          <Field label={t('Até')} value={toText} onChangeText={(v) => setDay('to', v)} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" style={{ flexGrow: 1, flexBasis: 150 * fontScale }} />
        </Row>
        {datesBad ? (
          <T v="tiny" color={C.bad}>
            {t('O último dia tem de ser depois do primeiro.')}
          </T>
        ) : (
          <T v="tiny">{t('As sessões que jogares nestes dias entram na viagem do festival.')}</T>
        )}
        <Field
          label={t('Nome')}
          value={x.name}
          onChangeText={(name) => {
            setNamed(true);
            set({ name: name.slice(0, 60) });
          }}
          placeholder={t('Ex.: Malta, novembro 2026')}
        />
        <Section title={t('Moeda')}>
          {currencyLocked ? (
            <View style={{ gap: S.xs }}>
              <ChipRow>
                <Chip label={x.currency} active style={{ minWidth: 48 }} />
              </ChipRow>
              <T v="tiny">{t('Já tem entradas nesta moeda, por isso não muda.')}</T>
            </View>
          ) : (
            <ChipRow>
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} active={x.currency === c} onPress={() => set({ currency: c })} style={{ minWidth: 48 }} />
              ))}
            </ChipRow>
          )}
        </Section>
        <View style={{ gap: S.sm }}>
          <Button title={editing ? t('Guardar') : t('Adicionar festival')} icon="checkmark" disabled={!ownFestivalOk(x)} onPress={save} />
          {editing ? <Button title={t('Apagar festival')} kind="danger" icon="trash-outline" size="md" onPress={remove} /> : null}
        </View>
      </ScrollView>
    </>
  );
}
