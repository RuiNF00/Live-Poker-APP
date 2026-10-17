// A tournament from the buy-in receipt: photograph the paper ticket from
// registration, the phone reads it (nothing is uploaded), one tap starts the
// tournament with the event, buy-in, table and seat filled in. When it can't
// be read, the usual form opens with the photo already attached. The photo
// stays on the phone and never goes into the cloud backup (docs.ts).

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blankSession, SessionForm } from '@/components/SessionForm';
import { Banner, Button, Card, ListGroup, ListItem, Row, T, tap } from '@/components/ui';
import { locale, t } from '@/i18n';
import { applyReceipt, isPast, parseReceipt, seatLine, usable, type ReceiptGuess } from '@/import/receipt';
import { docUri, dropDoc, pickDoc, type DocSource } from '@/lib/docs';
import { track } from '@/lib/events';
import { canReadReceipts, readReceiptText } from '@/lib/receipt-ocr';
import { chips, money } from '@/poker/format';
import { uid, useStore } from '@/store/store';
import type { Session, SessionDoc } from '@/store/types';
import { C, R, S } from '@/theme';

type Step = { at: 'pick' } | { at: 'reading' } | { at: 'read'; doc: SessionDoc; guess: ReceiptGuess; ok: boolean } | { at: 'form'; doc: SessionDoc | null; guess: ReceiptGuess; read: boolean };

export default function ReceiptScreen() {
  const { activeSession, sessions, saveSession, settings, bankrolls, defaultBankroll } = useStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ at: 'pick' });
  const recentNames = useMemo(() => [...new Set(sessions.map((s) => s.name).filter(Boolean))].slice(0, 8), [sessions]);
  const recentVenues = useMemo(() => [...new Set(sessions.map((s) => s.venue).filter(Boolean))].slice(0, 8), [sessions]);
  const venue = sessions.find((s) => s.kind === 'mtt' && s.venue)?.venue ?? '';
  const base = (): Session => ({ ...blankSession('mtt', defaultBankroll.currency, settings.defaultTableSize), bankrollId: defaultBankroll.id, venue, format: 'live' });

  const snap = async (source: DocSource) => {
    const id = uid('d_');
    const got = await pickDoc(source, id).catch(() => null);
    if (!got) return;
    const doc: SessionDoc = { id, name: got.name, file: got.file, kind: 'receipt', addedAt: Date.now() };
    setStep({ at: 'reading' });
    const lines = await readReceiptText(docUri(got.file));
    const guess = lines ? parseReceipt(lines) : {};
    const ok = usable(guess);
    track('receipt_read', { ok, native: canReadReceipts, fields: Object.keys(guess).length });
    if (ok) {
      tap('success');
      setStep({ at: 'read', doc, guess, ok });
    } else setStep({ at: 'form', doc, guess, read: false });
  };

  const start = (s: Session) => {
    tap('success');
    saveSession(s);
    router.replace(s.endedAt ? '/(tabs)/bankroll' : '/(tabs)/session');
  };
  const cancel = () => {
    // A photo nobody kept: don't leave it on the phone.
    if ((step.at === 'read' || step.at === 'form') && step.doc) dropDoc(step.doc.file);
    router.back();
  };

  if (activeSession && step.at === 'pick')
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: S.gutter, gap: S.lg }}>
        <Stack.Screen options={{ title: t('Recibo do buy-in') }} />
        <Banner tone="warn" title={t('Já tens uma sessão a decorrer')} body={t('Termina a sessão "{name}" antes de começar outra.', { name: activeSession.name || t('Sessão') })} />
        <Button title={t('Ver sessão')} onPress={() => router.replace('/(tabs)/session')} />
      </View>
    );

  if (step.at === 'form') {
    const initial = applyReceipt(base(), step.guess, step.doc, bankrolls);
    const past = !!initial.endedAt;
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: t('Recibo do buy-in') }} />
        {!step.read ? (
          <Banner
            tone="warn"
            title={canReadReceipts ? t('Não conseguimos ler o recibo') : t('Esta versão da app não lê recibos')}
            body={t('Preenche o resto aqui. A foto fica guardada na sessão.')}
          />
        ) : null}
        <SessionForm
          initial={initial}
          past={past}
          bankrolls={bankrolls}
          recentNames={recentNames}
          recentVenues={recentVenues}
          submitLabel={past ? t('Guardar torneio') : t('Começar agora')}
          onSubmit={start}
        />
      </ScrollView>
    );
  }

  if (step.at === 'read') {
    const g = step.guess;
    const s = applyReceipt(base(), g, step.doc, bankrolls);
    const past = isPast(g);
    const seat = seatLine(g);
    const when = g.date ? new Date(g.date).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' }) + (g.hasTime ? ' · ' + new Date(g.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '') : null;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Stack.Screen options={{ title: t('Recibo do buy-in') }} />
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingBottom: 200 }}>
          <Row gap={S.md}>
            <Thumb uri={docUri(step.doc.file)} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="label" color={C.good}>
                {t('Lido no telemóvel')}
              </T>
              <T v="h2" numberOfLines={2}>
                {s.name || t('Torneio')}
              </T>
              {when ? <T v="small">{when}</T> : null}
            </View>
          </Row>
          <Card tone="accent" style={{ gap: S.xs }}>
            <T v="label" color={C.accent}>
              {t('Buy-in')}
            </T>
            <T v="display">{money(s.buyIn, s.currency)}</T>
            {g.fee ? <T v="small">{t('{buyin} + {fee} de fee', { buyin: money(s.buyIn - g.fee, s.currency), fee: money(g.fee, s.currency) })}</T> : null}
          </Card>
          <ListGroup>
            {seat ? <ListItem icon="grid-outline" iconColor={C.accent} title={seat} chevron={false} /> : null}
            {g.stack ? <ListItem icon="layers-outline" iconColor={C.accent} title={t('Stack inicial')} subtitle={chips(g.stack)} chevron={false} /> : null}
            {s.venue ? <ListItem icon="location-outline" iconColor={C.accent} title={s.venue} subtitle={t('A tua última sala')} chevron={false} /> : null}
          </ListGroup>
          <T v="tiny" style={{ paddingHorizontal: 4 }}>
            {t('O recibo foi lido no telemóvel e fica só na sessão. Não vai para a nuvem.')}
          </T>
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: S.gutter, paddingTop: S.md, paddingBottom: insets.bottom + S.md, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.hairline, gap: S.sm }}>
          {past ? (
            <Button title={t('Guardar torneio')} icon="checkmark" haptic={false} onPress={() => setStep({ at: 'form', doc: step.doc, guess: g, read: true })} />
          ) : (
            <Button title={t('Começar torneio')} icon="play" haptic={false} onPress={() => start({ ...s, startedAt: Date.now(), stackLog: [{ t: Date.now(), stack: s.stack, level: s.level }] })} />
          )}
          <Row gap={S.sm}>
            <Button kind="secondary" title={t('Corrigir')} style={{ flex: 1 }} onPress={() => setStep({ at: 'form', doc: step.doc, guess: g, read: true })} />
            <Button kind="ghost" title={t('Cancelar')} style={{ flex: 1 }} onPress={cancel} />
          </Row>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: t('Recibo do buy-in') }} />
      <ScrollView contentContainerStyle={{ padding: S.gutter, paddingTop: S.xl, gap: S.xl, paddingBottom: 200 }}>
        <View style={{ gap: S.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: S.xs }}>
            <Ionicons name="receipt-outline" size={28} color={C.accent} />
          </View>
          <T v="title">{t('Fotografa o recibo do buy-in')}</T>
          <T v="callout">{t('Lemos o torneio, o buy-in e a fee, a data, a mesa e o lugar. Confirmas num toque.')}</T>
        </View>
        <ListGroup>
          <ListItem icon="lock-closed-outline" iconColor={C.good} title={t('Lido no teu telemóvel')} subtitle={t('A foto não é enviada a ninguém e não vai para a nuvem.')} chevron={false} />
          <ListItem icon="create-outline" iconColor={C.accent} title={t('Se não der para ler')} subtitle={t('Abre o formulário normal, com a foto já anexada.')} chevron={false} />
        </ListGroup>
        {step.at === 'reading' ? (
          <Row gap={S.sm} style={{ justifyContent: 'center' }}>
            <ActivityIndicator color={C.accent} />
            <T v="callout">{t('A ler o recibo…')}</T>
          </Row>
        ) : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: S.gutter, paddingTop: S.md, paddingBottom: insets.bottom + S.md, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.hairline, gap: S.sm }}>
        {Platform.OS !== 'web' ? (
          <>
            <Button title={t('Tirar foto')} icon="camera" disabled={step.at === 'reading'} onPress={() => snap('camera')} />
            <Button kind="secondary" title={t('Escolher da galeria')} icon="images-outline" disabled={step.at === 'reading'} onPress={() => snap('photos')} />
          </>
        ) : (
          <Button title={t('Escolher a foto')} icon="images-outline" disabled={step.at === 'reading'} onPress={() => snap('photos')} />
        )}
      </View>
    </View>
  );
}

function Thumb({ uri }: { uri: string }) {
  return (
    <View style={{ width: 64, height: 84, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
    </View>
  );
}
