// Shown once when the player turns the trial off in the store ("cancelled"),
// and once after it ends without Pro ("ended"). Calm on purpose: nothing is
// lost, and the goal is that they keep using the free app and sharing.
// See src/billing/trial-moments.ts.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scrubNote } from '@/billing/cancel';
import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { Button, Card, Field, ListGroup, ListItem, Row, T, type IconName } from '@/components/ui';
import { locale, t } from '@/i18n';
import { track } from '@/lib/events';
import { noteReviewBlocker } from '@/lib/review';
import { C, S } from '@/theme';

type Reason = 'notPlaying' | 'bankroll' | 'feature';

const REASONS: { key: Reason; icon: IconName; label: string }[] = [
  { key: 'notPlaying', icon: 'pause-circle-outline', label: 'Não estou a jogar live agora' },
  { key: 'bankroll', icon: 'wallet-outline', label: 'Não cabe no meu bankroll agora' },
  { key: 'feature', icon: 'construct-outline', label: 'Falta-me uma funcionalidade' },
];

export default function TrialNotice() {
  const insets = useSafeAreaInsets();
  const { kind, end } = useLocalSearchParams<{ kind?: string; end?: string }>();
  const ended = kind === 'ended';
  const { plans, paywall } = usePro();
  const monthly = plans.find((p) => p.id === 'monthly');
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const until = end ? new Date(Number(end)).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) : '';

  useEffect(() => {
    track('cancel_flow', { step: ended ? 'trial_ended' : 'open', source: 'trial' });
    void noteReviewBlocker('cancel');
  }, [ended]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const toPaywall = () => {
    close();
    setTimeout(() => paywall('generic'), 350);
  };
  const pick = (r: Reason) => {
    track('cancel_flow', { step: 'reason', reason: r, source: 'trial' });
    setReason(r);
  };
  const send = () => {
    track('cancel_flow', { step: 'feedback', reason: reason ?? '', note: scrubNote(note), source: 'trial' });
    setSent(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + S.xl, paddingHorizontal: S.gutter, paddingBottom: S.xl, gap: S.xl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ gap: S.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={ended ? 'leaf-outline' : 'checkmark-circle-outline'} size={28} color={C.accent} />
          </View>
          <T v="title">{ended ? t('O teu trial acabou') : t('O teu Pro continua até {date}', { date: until })}</T>
          <T v="callout">{ended ? t('Nada do que registaste se perde.') : t('Não vais ser cobrado. Tudo o que registares fica teu, mesmo depois.')}</T>
        </View>

        {ended ? (
          <View style={{ gap: S.sm }}>
            <T v="label">{t('O que fica grátis')}</T>
            <ListGroup>
              <ListItem icon="albums-outline" title={FREE.handsPerDay ? t('{n} mãos novas por dia', { n: FREE.handsPerDay }) : t('Mãos ilimitadas')} />
              <ListItem icon="link-outline" title={t('Partilha por link sem limite')} />
              <ListItem icon="play-circle-outline" title={t('Replayer, sessões e bankroll')} />
              <ListItem icon="calculator-outline" title={t('Calculadora de odds e planeador de festivais')} />
            </ListGroup>
          </View>
        ) : reason === null ? (
          <View style={{ gap: S.sm }}>
            <T v="h2">{t('O que te fez desligar?')}</T>
            <ListGroup>
              {REASONS.map((r) => (
                <ListItem key={r.key} icon={r.icon} title={t(r.label)} onPress={() => pick(r.key)} />
              ))}
            </ListGroup>
          </View>
        ) : (
          <Card tone="raised" style={{ gap: S.md }}>
            <Row gap={S.sm}>
              <T v="h3" style={{ flex: 1 }}>
                {t(REASONS.find((r) => r.key === reason)!.label)}
              </T>
              <Button kind="ghost" small title={t('Mudar')} onPress={() => setReason(null)} />
            </Row>
            {reason === 'notPlaying' ? (
              <>
                <T v="small">{t('Marca o próximo festival no planeador. Quando voltares a jogar, o caderno está como o deixaste.')}</T>
                <Button
                  kind="secondary"
                  icon="calendar-outline"
                  title={t('Lembra-me no próximo festival')}
                  onPress={() => {
                    track('cancel_flow', { step: 'festival', source: 'trial' });
                    router.replace('/festival');
                  }}
                />
              </>
            ) : reason === 'bankroll' ? (
              <>
                <T v="small">{monthly ? t('O mensal custa {price} e cancelas quando quiseres.', { price: monthly.priceString }) : t('Também há um plano mensal, que cancelas quando quiseres.')}</T>
                <Button kind="secondary" title={t('Ver os planos')} onPress={toPaywall} />
              </>
            ) : sent ? (
              <T v="small">{t('Obrigado. Lemos tudo o que nos mandam.')}</T>
            ) : (
              <>
                <Field label={t('O que te falta?')} value={note} onChangeText={setNote} maxLength={120} multiline />
                <Button kind="secondary" title={t('Enviar')} disabled={!note.trim()} onPress={send} />
              </>
            )}
          </Card>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm, paddingBottom: insets.bottom + S.sm, gap: S.xs, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
        <Button title={ended ? t('Continuar no grátis') : t('Fechar')} onPress={close} />
        {ended ? <Button kind="ghost" title={t('Ver o Pro')} onPress={toPaywall} /> : null}
      </View>
    </View>
  );
}
