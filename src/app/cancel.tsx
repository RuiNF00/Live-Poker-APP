import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cancelReasons, logged, scrubNote, type CancelReason } from '@/billing/cancel';
import { annualSavingPct, formatPrice, perMonth, RETENTION } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { getSubscription, lifetimeOffer, manageSubscription, retentionOffer } from '@/billing/purchases';
import { Button, Card, Field, ListGroup, ListItem, Row, T, type IconName } from '@/components/ui';
import { locale, t } from '@/i18n';
import { track } from '@/lib/events';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { BRAND, C, S } from '@/theme';

type Offer = Awaited<ReturnType<typeof retentionOffer>>;

export default function Cancel() {
  const insets = useSafeAreaInsets();
  const { hands, sessions } = useStore();
  const { plans, purchase, restore } = usePro();
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [plan, setPlan] = useState<'monthly' | 'annual' | null>(null);
  const [willRenew, setWillRenew] = useState<boolean | null>(null);
  const [offer, setOffer] = useState<Offer>(null);
  const [lifetime, setLifetime] = useState<Offer>(null);
  // The reason shows only when there's a one-time Pro in the store to offer for it.
  const CANCEL_REASONS = cancelReasons(!!lifetime);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const store = Platform.OS === 'android' ? 'Google Play' : 'App Store';
  const mine = logged(hands, sessions);

  useEffect(() => {
    track('cancel_flow', { step: 'open' });
    getSubscription().then((s) => {
      setPlan(s?.plan ?? null);
      setWillRenew(s?.willRenew ?? null);
    });
    lifetimeOffer().then(setLifetime);
  }, []);
  useEffect(() => {
    if (reason === 'bankroll') retentionOffer(plans).then(setOffer);
  }, [reason, plans]);

  // Lifetime is judged on long-term revenue: who saw it, from which plan, and
  // whether the subscription was still set to renew (i.e. they were about to cancel).
  const lifetimeProps = () => ({ reason: reason ?? '', plan: plan ?? '', will_renew: willRenew ?? '' });
  const pick = (r: CancelReason) => {
    track('cancel_flow', { step: 'reason', reason: r });
    if (r === 'noSubscription' && lifetime) track('lifetime_offer_shown', { reason: r, plan: plan ?? '', will_renew: willRenew ?? '' });
    setReason(r);
  };
  const keep = () => {
    track('cancel_flow', { step: 'kept', reason: reason ?? '' });
    router.back();
  };
  const toStore = () => {
    track('cancel_flow', { step: 'store', reason: reason ?? '' });
    void manageSubscription();
  };
  const result = (res: string, what: string) => {
    track('cancel_flow', { step: 'offer', reason: reason ?? '', offer: what, result: res });
    if (res === 'ok') {
      Alert.alert(t('Feito'), t('O teu Pro continua.'));
      router.back();
    } else if (res === 'error') Alert.alert(t('Não deu para concluir'), t('Não foi cobrado nada. Tenta outra vez daqui a pouco.'));
  };
  // Pro for good, but the subscription is still running: send them to the store to stop it.
  const lifetimeResult = (res: string) => {
    track('cancel_flow', { step: 'offer', reason: reason ?? '', offer: 'lifetime', result: res });
    if (res === 'ok') {
      track('lifetime_purchased', lifetimeProps());
      // The subscription keeps renewing until the player cancels it: straight to the store's page (payments audit §7).
      toStore();
    } else if (res === 'error') Alert.alert(t('Não deu para concluir'), t('Não foi cobrado nada. Tenta outra vez daqui a pouco.'));
  };
  const onRestore = async () => {
    track('cancel_flow', { step: 'restore' });
    const ok = await restore();
    Alert.alert(ok ? t('Compras restauradas') : t('Sem compras'), ok ? t('O teu Pro está ativo nesta conta da loja.') : t('Não encontrámos nenhuma subscrição nesta conta da loja.'));
  };
  const send = () => {
    track('cancel_flow', { step: 'feedback', reason: reason ?? '', note: scrubNote(note) });
    setSent(true);
  };

  const annual = plans.find((p) => p.id === 'annual');
  const monthly = plans.find((p) => p.id === 'monthly');
  // Switching plans inside one App Store group is a plain purchase; Google Play needs a plan change we don't do yet.
  const toAnnual = plan === 'monthly' && annual && Platform.OS === 'ios';

  return (
    <>
      <Stack.Screen options={{ title: t('A tua subscrição') }} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: S.xl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {mine ? (
            <View style={{ gap: S.sm }}>
              <T v="label">{t('No teu caderno')}</T>
              {mine.sessions > 0 ? (
                <T v="monoL" color={mine.profit >= 0 ? C.good : C.bad}>
                  {(mine.profit > 0 ? '+' : '') + money(mine.profit, mine.currency)}
                </T>
              ) : null}
              <T v="callout">
                {t('{what} desde {month}.', {
                  what: [
                    mine.sessions === 0 ? null : mine.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: mine.sessions }),
                    mine.hands === 0 ? null : mine.hands === 1 ? t('1 mão') : t('{n} mãos', { n: mine.hands }),
                  ]
                    .filter(Boolean)
                    .join(t(' e ')),
                  month: new Date(mine.since).toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
                })}
              </T>
              <T v="small">{t('Fica tudo guardado. Sem Pro, voltas às 3 mãos por dia.')}</T>
            </View>
          ) : null}

          {reason === null ? (
            <View style={{ gap: S.sm }}>
              <T v="h2">{t('Porque queres cancelar?')}</T>
              <ListGroup>
                {CANCEL_REASONS.map((r) => (
                  <ListItem key={r.key} icon={r.icon as IconName} title={t(r.label)} onPress={() => pick(r.key)} />
                ))}
              </ListGroup>
            </View>
          ) : (
            <View style={{ gap: S.md }}>
              <Row gap={S.sm}>
                <T v="h2" style={{ flex: 1 }}>
                  {t(CANCEL_REASONS.find((r) => r.key === reason)!.label)}
                </T>
                <Button kind="ghost" small title={t('Mudar')} onPress={() => {
                    setReason(null);
                    setSent(false);
                    setNote('');
                  }}
                />
              </Row>

              {reason === 'notPlaying' ? (
                Platform.OS === 'android' ? (
                  <OfferCard icon="pause" title={t('Pausa até {n} meses', { n: RETENTION.pauseMonths })} body={t('Na Google Play, em vez de cancelar. Voltas com tudo como deixaste.')}>
                    <Button title={t('Pausar na Google Play')} onPress={toStore} />
                  </OfferCard>
                ) : (
                  <OfferCard icon="bookmark" title={t('O teu caderno espera por ti')} body={t('Quando voltares, o Pro volta com tudo. Mãos, sessões e bankroll ficam.')} />
                )
              ) : null}

              {reason === 'bankroll' ? (
                <>
                  {offer ? (
                    <OfferCard icon="pricetag" title={t('−{pct}% durante {n} meses', { pct: RETENTION.discount.pct, n: RETENTION.discount.months })} body={monthly ? t('{price} por mês durante {n} meses. Depois, {monthly} por mês, até cancelares.', { price: offer.priceString, n: RETENTION.discount.months, monthly: monthly.priceString }) : t('{price} por mês. Depois, o preço normal.', { price: offer.priceString })}>
                      <Button title={t('Aceitar a oferta')} onPress={async () => result(await offer.buy(), 'discount')} />
                    </OfferCard>
                  ) : null}
                  {toAnnual ? (
                    <OfferCard
                      icon="calendar"
                      title={t('Anual: {price} por mês', { price: formatPrice(perMonth(annual.price), annual.currency, locale) })}
                      body={t('{price} por ano, −{pct}% face ao mensal.', { price: annual.priceString, pct: monthly ? annualSavingPct(monthly.price, annual.price) : 0 })}>
                      <Button kind="secondary" title={t('Mudar para o anual')} onPress={async () => result(await purchase('annual'), 'annual')} />
                    </OfferCard>
                  ) : null}
                  {!offer && !toAnnual ? <OfferCard icon="wallet" title={t('Fica tudo guardado')} body={t('Sem Pro, continuas a registar 3 mãos por dia e a partilhar sem limite.')} /> : null}
                </>
              ) : null}

              {reason === 'noSubscription' ? (
                lifetime ? (
                  <OfferCard icon="infinite" title={t('Pro para sempre: {price}', { price: lifetime.priceString })} body={t('Pagas uma vez. A subscrição não é cancelada nem reembolsada sozinha: cancelas tu na {store}, logo a seguir.', { store })}>
                    <Button title={t('Comprar uma vez')} onPress={async () => lifetimeResult(await lifetime.buy())} />
                  </OfferCard>
                ) : (
                  <OfferCard icon="wallet" title={t('Fica tudo guardado')} body={t('Sem Pro, continuas a registar 3 mãos por dia e a partilhar sem limite.')} />
                )
              ) : null}

              {reason === 'slow' ? (
                <OfferCard icon="flash" title={t('Guarda em 5 toques')} body={t('Posição, as tuas 2 cartas e «Guardar já». O resto completas depois da sessão.')} />
              ) : null}

              {reason === 'feature' || reason === 'slow' || reason === 'otherApp' ? (
                sent ? (
                  <OfferCard icon="checkmark" title={t('Obrigado')} body={t('Lemos tudo o que nos mandam.')} />
                ) : (
                  <Card style={{ gap: S.md }}>
                    <Field
                      label={reason === 'otherApp' ? t('Qual app, e o que faz melhor?') : reason === 'slow' ? t('Onde perdes mais tempo?') : t('O que te falta?')}
                      value={note}
                      onChangeText={setNote}
                      maxLength={120}
                      multiline
                    />
                    <Button kind="secondary" title={t('Enviar')} disabled={!note.trim()} onPress={send} />
                  </Card>
                )
              ) : null}

              <Button title={t('Ficar com o Pro')} onPress={keep} />
            </View>
          )}
        </ScrollView>

        {/* Cancelling is never hidden or blocked: the store's page is one tap away on every step. */}
        <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm, paddingBottom: insets.bottom + S.sm, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
          <Button kind="ghost" title={t('Cancelar na {store}', { store })} onPress={toStore} />
          {/* Charged twice, or Pro missing after a reinstall: the fixes are here too, not only in Settings. */}
          <Row gap={S.lg} style={{ justifyContent: 'center', paddingTop: S.xs }}>
            <Pressable onPress={onRestore} hitSlop={8} accessibilityRole="button">
              <T v="tiny" color={C.textDim}>
                {t('Restaurar compras')}
              </T>
            </Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/support`)} hitSlop={8} accessibilityRole="link">
              <T v="tiny" color={C.textDim}>
                {t('Ajuda e contacto')}
              </T>
            </Pressable>
          </Row>
        </View>
      </View>
    </>
  );
}

function OfferCard({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: React.ReactNode }) {
  return (
    <Card tone="raised" style={{ gap: S.md }}>
      <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={C.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3">{title}</T>
          <T v="small">{body}</T>
        </View>
      </Row>
      {children}
    </Card>
  );
}
