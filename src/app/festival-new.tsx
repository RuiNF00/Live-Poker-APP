// "Adicionar o meu festival": a series we don't ship. Name, city, dates and
// currency; it then sits in the planner and makes a trip like the others.
// With ?id=, edits (or deletes) one the player added.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { CURRENCIES } from '@/components/BankrollSheets';
import { Button, Chip, ChipRow, Field, Row, Section, T, tap } from '@/components/ui';
import { locale, t } from '@/i18n';
import { dayKey, deleteOwnFestival, festivalById, ownFestival, ownFestivalOk, saveOwnFestival, type OwnFestivalInput } from '@/store/my-festivals';
import { parseDay } from '@/store/session-math';
import { uid, useStore } from '@/store/store';
import { C, S } from '@/theme';

const dd = (day: string) => (day ? new Date(day + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function FestivalNewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { settings } = useStore();
  const old = festivalById(id);
  const editing = !!old?.own;
  const [x, setX] = useState<OwnFestivalInput>(() =>
    old?.own && old.dates ? { name: old.name, city: old.venue, currency: old.currency, from: old.dates.from, to: old.dates.to } : { name: '', city: '', currency: settings.currency, from: '', to: '' },
  );
  const [fromText, setFromText] = useState(dd(x.from));
  const [toText, setToText] = useState(dd(x.to));
  const set = (p: Partial<OwnFestivalInput>) => setX((c) => ({ ...c, ...p }));

  const setDay = (which: 'from' | 'to', v: string) => {
    (which === 'from' ? setFromText : setToText)(v);
    const d = parseDay(v, Date.now(), true);
    set({ [which]: d === null ? '' : dayKey(d) });
  };

  const save = () => {
    tap('success');
    const f = ownFestival(old?.own ? old.id : uid('fx_'), x);
    saveOwnFestival(f);
    if (editing) router.back();
    else router.replace({ pathname: '/festival', params: { id: f.id } });
  };

  const remove = () => {
    const go = () => {
      if (old) deleteOwnFestival(old.id);
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
        <Field label={t('Nome')} value={x.name} onChangeText={(name) => set({ name: name.slice(0, 60) })} placeholder={t('Ex.: Malta, novembro 2026')} autoFocus={!editing} />
        <Field label={t('Cidade')} value={x.city} onChangeText={(city) => set({ city: city.slice(0, 40) })} placeholder={t('Ex.: St. Julian’s')} />
        <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
          <Field label={t('De')} value={fromText} onChangeText={(v) => setDay('from', v)} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
          <Field label={t('Até')} value={toText} onChangeText={(v) => setDay('to', v)} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
        </Row>
        {datesBad ? (
          <T v="tiny" color={C.bad}>
            {t('O último dia tem de ser depois do primeiro.')}
          </T>
        ) : (
          <T v="tiny">{t('As sessões que jogares nestes dias entram na viagem do festival.')}</T>
        )}
        <Section title={t('Moeda')}>
          <ChipRow>
            {CURRENCIES.map((c) => (
              <Chip key={c} label={c} active={x.currency === c} onPress={() => set({ currency: c })} style={{ minWidth: 48 }} />
            ))}
          </ChipRow>
        </Section>
        <View style={{ gap: S.sm }}>
          <Button title={editing ? t('Guardar') : t('Adicionar festival')} icon="checkmark" disabled={!ownFestivalOk(x)} onPress={save} />
          {editing ? <Button title={t('Apagar festival')} kind="danger" icon="trash-outline" size="md" onPress={remove} /> : null}
        </View>
      </ScrollView>
    </>
  );
}
