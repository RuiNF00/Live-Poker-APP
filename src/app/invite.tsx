// Invite friends: your link, how many came, and the discount on the first month of Pro when one is waiting.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { INVITE } from '@/billing/plans';
import { buyNotice, usePro } from '@/billing/pro';
import { invitePct } from '@/billing/disclosure';
import { inviteOfferPrice, LIVE, redeemInviteOffer } from '@/billing/purchases';
import { LegalLinks } from '@/components/LegalLinks';
import { Button, Card, ListGroup, ListItem, Stat, StatGrid, T, tap } from '@/components/ui';
import { t, variant } from '@/i18n';
import { track } from '@/lib/events';
import { notice } from '@/lib/notice';
import { withLang } from '@/lib/link-lang';
import { markShared, inviteStatus, type InviteStatus } from '@/lib/referrals';
import { shortDate } from '@/poker/format';
import { C, F, R, S } from '@/theme';

export default function InviteScreen() {
  const pro = usePro();
  const monthly = pro.plans.find((p) => p.id === 'monthly');
  const offerPrice = inviteOfferPrice(pro.plans);
  // On Google Play the discount is the store's own offer: its % comes from the store, and without it
  // nothing is claimed (the App Store's code sheet shows Apple's own price).
  const playOffer = Platform.OS === 'android' && LIVE;
  const offerPct = invitePct(playOffer, monthly?.price, offerPrice?.price, INVITE.pct);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<InviteStatus | null | undefined>(undefined);
  const [limited, setLimited] = useState(false);
  const got = (r: InviteStatus | 'rate_limited' | null) => {
    setLimited(r === 'rate_limited');
    setS(r === 'rate_limited' ? null : r);
  };
  const load = () => {
    setS(undefined);
    inviteStatus().then(got);
  };
  useEffect(() => {
    inviteStatus().then(got);
  }, []);

  // The friend's page opens in the inviter's language (the link carries ?lang=).
  const share = async (to?: 'whatsapp') => {
    if (!s) return;
    tap('medium');
    const msg = t('Uso o Sweatbook para guardar as minhas mãos de póquer ao vivo. Experimenta: se guardares a primeira mão, recebemos os dois {pct}% no primeiro mês do Pro. {url}', { pct: INVITE.pct, url: withLang(s.url, variant) });
    track('link_shared', { channel: to === 'whatsapp' ? 'invite_whatsapp' : 'invite' });
    void markShared();
    if (to === 'whatsapp') {
      // Straight to WhatsApp's chat picker: one tap less than the system sheet. Without WhatsApp, the usual sheet.
      const text = encodeURIComponent(msg);
      const url = Platform.OS === 'web' ? `https://wa.me/?text=${text}` : `whatsapp://send?text=${text}`;
      await Linking.openURL(url).catch(() => Share.share({ message: msg }));
    } else if (Platform.OS === 'web') await Clipboard.setStringAsync(msg);
    else await Share.share({ message: msg });
  };

  // The discount on the monthly: Google Play buys it here, the App Store redeems the player's code.
  const takeOffer = async () => {
    if (!s?.offer || busy) return;
    const store = Platform.OS === 'android' ? 'Google Play' : 'App Store';
    setBusy(true);
    if (s.offer.iosCode) await Clipboard.setStringAsync(s.offer.iosCode);
    const res = await redeemInviteOffer(pro.plans, s.offer.iosCode);
    setBusy(false);
    // The invite discount used in the app (Google Play); an App Store code finishes in the store and comes from RevenueCat's webhook (store_purchase, offer: code).
    if (res === 'ok') {
      track('purchase', { plan: 'monthly', reason: 'invite', offer: 'invite' });
      router.back();
    } else if (res === 'pending') notice(t('Compra pendente'), t('O Pro liga-se sozinho quando a {store} confirmar o pagamento.', { store }));
    else if (res === 'unavailable') notice(t('Não deu para abrir o desconto'), t('Tenta outra vez daqui a pouco. O desconto continua guardado aqui.'));
    else if (res === 'error') notice(t('Não deu para concluir'), t('Tenta outra vez daqui a pouco. O desconto continua guardado aqui.'));
    else if (res !== 'redeem') buyNotice(res, store);
  };

  const steps: [React.ComponentProps<typeof Ionicons>['name'], string][] = [
    ['paper-plane-outline', t('Envias o teu link a um amigo')],
    ['download-outline', t('O teu amigo instala e guarda a primeira mão')],
    ['flash-outline', t('Recebem os dois {pct}% no primeiro mês do Pro', { pct: INVITE.pct })],
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('Convidar amigos') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 48 }}>
        <View style={{ alignItems: 'center', gap: S.md, paddingTop: S.sm }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="gift" size={34} color={C.accent} />
          </View>
          <T v="title" style={{ textAlign: 'center', fontSize: 28 }}>
            {t('{pct}% no primeiro mês por amigo', { pct: INVITE.pct })}
          </T>
          <T v="callout" style={{ textAlign: 'center' }}>
            {t('Para ti e para o teu amigo. Até 10 amigos por ano.')}
          </T>
        </View>

        {s?.offer && !pro.isPro ? (
          <Card tone="accent" style={{ gap: S.sm }}>
            <T v="h3" color={C.accent}>
              {offerPct !== null ? t('Tens {pct}% no primeiro mês do Pro', { pct: offerPct }) : t('Tens um desconto no primeiro mês do Pro')}
            </T>
            <T v="small">{t('Do teu convite. Dá para usar até {date}.', { date: shortDate(Date.parse(s.offer.until)) })}</T>
            {s.offer.iosCode ? (
              <T v="small">
                {t('Código da App Store: {code}. Fica copiado para colares se a App Store o pedir.', { code: s.offer.iosCode })}
              </T>
            ) : null}
            {/* A purchase on Google Play: what it costs, what it renews at, and the legal links (App Store 3.1.2, Play). Prices only from the store. */}
            {offerPct === null ? (
              <T v="small" color={C.text}>
                {t('O desconto ainda não aparece na Google Play. Fica guardado aqui: tenta outra vez mais tarde.')}
              </T>
            ) : (
              <>
                {monthly ? (
                  <T v="small" color={C.text}>
                    {offerPrice
                      ? t('{price} no primeiro mês. Depois, {monthly} por mês, até cancelares.', { price: offerPrice.priceString, monthly: monthly.priceString })
                      : t('{pct}% no primeiro mês. Depois, {monthly} por mês, até cancelares.', { pct: offerPct, monthly: monthly.priceString })}
                  </T>
                ) : null}
                <Button title={t('Usar o desconto')} icon="pricetag" disabled={busy} onPress={takeOffer} />
                <T v="tiny">{t('Renova automaticamente até cancelares nas definições da {store}, pelo menos 24 horas antes do fim do período.', { store: Platform.OS === 'android' ? 'Google Play' : 'App Store' })}</T>
                <LegalLinks />
              </>
            )}
          </Card>
        ) : null}

        <ListGroup>
          {steps.map(([ic, label], i) => (
            <ListItem key={i} left={<T v="mono" color={C.accent} style={{ width: 16 }}>{String(i + 1)}</T>} icon={ic} title={label} numberOfLines={2} />
          ))}
        </ListGroup>

        {s === undefined ? null : s === null ? (
          <Card tone="warn" style={{ gap: S.sm }}>
            <T v="h3" color={C.warn}>
              {limited ? t('Demasiados pedidos. Tenta daqui a pouco.') : t('Sem ligação ao servidor')}
            </T>
            {limited ? null : <T v="small">{t('Não deu para carregar o teu link. Verifica a rede e tenta outra vez.')}</T>}
            <Button size="sm" kind="secondary" icon="refresh" title={t('Tentar outra vez')} style={{ alignSelf: 'flex-start' }} onPress={load} />
          </Card>
        ) : (
          <>
            <View style={{ gap: S.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Copiar link')}
                onPress={async () => {
                  await Clipboard.setStringAsync(withLang(s.url, variant));
                  tap();
                }}
                style={({ pressed }) => ({ backgroundColor: C.bgDeep, borderRadius: R.md, borderWidth: 1, borderColor: C.borderStrong, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}>
                <T selectable style={{ flex: 1, fontFamily: F.monoRegular, fontSize: 14, color: C.text }} numberOfLines={1}>
                  {s.url.replace(/^https:\/\//, '')}
                </T>
                <Ionicons name="copy-outline" size={18} color={C.accent} />
              </Pressable>
              <Button title={t('Enviar no WhatsApp')} icon="logo-whatsapp" onPress={() => share('whatsapp')} />
              <Button kind="secondary" title={t('Outras apps')} icon="share-social" onPress={() => share()} />
            </View>
            <StatGrid cols={3}>
              <Stat label={t('Convidados')} value={String(s.invited)} />
              <Stat label={t('A usar')} value={String(s.activated)} />
              <Stat label={t('Descontos')} value={String(s.discounts)} tone={s.discounts ? 'accent' : undefined} />
            </StatGrid>
          </>
        )}
        <T v="tiny" style={{ textAlign: 'center' }}>
          {t('Conta quando o amigo guarda a primeira mão nos 7 dias depois de instalar.')}
        </T>
      </ScrollView>
    </>
  );
}
