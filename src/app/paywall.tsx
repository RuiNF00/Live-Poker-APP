import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { annualSavingPct, featuresFor, formatPrice, FREE, LEGAL, PAYWALL_COPY, perMonth, PLANS, type PaywallReason, type PlanId } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { Row, T, tap } from '@/components/ui';
import { locale, t } from '@/i18n';
import { useStore } from '@/store/store';
import { BRAND, C, R, ff } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { reason = 'generic' } = useLocalSearchParams<{ reason?: PaywallReason }>();
  const { plans, purchase, restore, isPro } = usePro();
  const { hands } = useStore();
  const [sel, setSel] = useState<PlanId>('annual');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  // Set when Pro arrives on this screen (purchase or restore), to say what just unlocked.
  const [welcomed, setWelcomed] = useState(false);
  const copy = PAYWALL_COPY[reason] ?? PAYWALL_COPY.generic;

  const monthly = plans.find((p) => p.id === 'monthly');
  const annual = plans.find((p) => p.id === 'annual');
  const saving = monthly && annual ? annualSavingPct(monthly.price, annual.price) : annualSavingPct(PLANS.monthly.price, PLANS.annual.price);
  const chosen = sel === 'annual' ? annual : monthly;
  const trial = chosen?.trialDays ?? 0;
  const annualTrial = annual?.trialDays ?? 0;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onBuy = async () => {
    tap('medium');
    setBusy('buy');
    const res = await purchase(sel, reason);
    setBusy(null);
    if (res === 'ok') setWelcomed(true);
    else if (res === 'unavailable') Alert.alert(t('Ainda não disponível'), t('As subscrições ainda não estão ativas nesta versão.'));
    else if (res === 'error') Alert.alert(t('Não deu para concluir'), t('Não foi cobrado nada. Tenta outra vez daqui a pouco.'));
  };

  const onRestore = async () => {
    setBusy('restore');
    const ok = await restore();
    setBusy(null);
    if (ok) setWelcomed(true);
    else Alert.alert(t('Sem compras'), t('Não encontrámos nenhuma subscrição nesta conta da loja.'));
  };

  const store = Platform.OS === 'android' ? 'Google Play' : 'App Store';
  const after = chosen ? t('{price} por {period}', { price: chosen.priceString, period: t(PLANS[sel].period) }) : '';

  if (isPro)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 }}>
        <Ionicons name="checkmark-circle" size={60} color={C.accent} />
        <T v="h1" style={{ textAlign: 'center' }}>
          {welcomed ? t('Bem-vindo ao Pro') : t('Já és Pro')}
        </T>
        {welcomed ? (
          <T v="body" color={C.textDim} style={{ textAlign: 'center', lineHeight: 21 }}>
            {reason === 'hands'
              ? t('Já não há limite de mãos. Toca em Guardar e a tua mão fica no caderno.')
              : reason === 'story'
                ? t('Já podes gravar a tua voz e tirar a marca da story.')
                : reason === 'stats'
                  ? t('Os filtros e os resultados por sala e jogo já estão abertos.')
                  : t('Regista todas as mãos que quiseres, sem limite diário.')}
          </T>
        ) : null}
        <Pressable
          onPress={close}
          style={({ pressed }) => ({ marginTop: 6, backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 14, paddingHorizontal: 36, opacity: pressed ? 0.85 : 1 })}>
          <T style={{ color: C.accentInk, fontSize: 16, fontWeight: '800', fontFamily: ff(800) }}>{reason === 'hands' && welcomed ? t('Voltar à mão') : t('Continuar')}</T>
        </Pressable>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 24, gap: 18 }}>
        <Pressable accessibilityLabel={t('Fechar')} onPress={close} hitSlop={12} style={{ alignSelf: 'flex-start', padding: 4 }}>
          <Ionicons name="close" size={26} color={C.textDim} />
        </Pressable>

        <View style={{ gap: 8 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: C.accentSoft, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T v="label" color={C.accent}>
              {BRAND.name} Pro
            </T>
          </View>
          <T v="title" style={{ fontSize: 28, lineHeight: 33 }}>
            {copy.title}
          </T>
          <T v="body" color={C.textDim} style={{ lineHeight: 21 }}>
            {copy.body}
          </T>
          {hands.length >= 3 && reason !== 'welcome' ? (
            <Row gap={6}>
              <Ionicons name="albums-outline" size={14} color={C.muted} />
              <T v="small">{t('Já tens {n} mãos no teu caderno.', { n: hands.length })}</T>
            </Row>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          {featuresFor(reason).map(({ feature: f, highlight }) => (
            <Row key={f.key} gap={12} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: highlight ? C.accent : C.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={f.icon as IconName} size={18} color={highlight ? C.accentInk : C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h2" style={{ fontSize: 15 }}>
                  {f.title}
                </T>
                <T v="small">{f.body}</T>
              </View>
            </Row>
          ))}
        </View>

        {plans.length === 0 ? (
          <ActivityIndicator color={C.accent} />
        ) : (
          <View style={{ gap: 10 }}>
            {annual ? (
              <PlanCard
                active={sel === 'annual'}
                onPress={() => setSel('annual')}
                title={t('Anual')}
                price={annual.priceString + ' / ' + t('ano')}
                was={monthly ? formatPrice(monthly.price * 12, monthly.currency, locale) : undefined}
                sub={t('{price} por mês', { price: formatPrice(perMonth(annual.price), annual.currency, locale) })}
                badge={annual.trialDays ? t('{days} dias grátis · poupa {pct}%', { days: annual.trialDays, pct: saving }) : t('Poupa {pct}%', { pct: saving })}
              />
            ) : null}
            {monthly ? <PlanCard active={sel === 'monthly'} onPress={() => setSel('monthly')} title={t('Mensal')} price={monthly.priceString + ' / ' + t('mês')} sub={t('Cancela quando quiseres')} /> : null}
            {sel === 'monthly' && annualTrial ? (
              <Pressable onPress={() => setSel('annual')} hitSlop={6}>
                <T v="small" color={C.accent} style={{ textAlign: 'center' }}>
                  {t('O plano anual começa com {days} dias grátis', { days: annualTrial })}
                </T>
              </Pressable>
            ) : null}
            {trial && chosen ? <TrialSteps days={trial} after={after} store={store} /> : null}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: insets.bottom + 10, gap: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg }}>
        <Pressable
          disabled={!chosen || !!busy}
          onPress={onBuy}
          style={({ pressed }) => ({
            backgroundColor: C.accent,
            borderRadius: R.md,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: !chosen || busy ? 0.5 : pressed ? 0.85 : 1,
          })}>
          {busy === 'buy' ? (
            <ActivityIndicator color={C.accentInk} />
          ) : (
            <T style={{ color: C.accentInk, fontSize: 17, fontWeight: '800', fontFamily: ff(800) }}>{trial ? t('Experimentar {days} dias grátis', { days: trial }) : t('Subscrever Pro')}</T>
          )}
        </Pressable>
        <T v="tiny" style={{ textAlign: 'center', lineHeight: 15 }}>
          {trial ? t('Grátis durante {days} dias, depois {after}.', { days: trial, after }) + ' ' : after ? `${after}. ` : ''}
          {t('Renova automaticamente até cancelares nas definições da {store}, pelo menos 24 horas antes do fim do período.', { store })}
        </T>
        <Row style={{ justifyContent: 'center' }} gap={18}>
          <Pressable onPress={onRestore} disabled={!!busy} hitSlop={6}>
            <T v="tiny" color={C.textDim}>
              {busy === 'restore' ? t('A restaurar…') : t('Restaurar compras')}
            </T>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(LEGAL.terms)} hitSlop={6}>
            <T v="tiny" color={C.textDim}>
              {t('Termos')}
            </T>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacy)} hitSlop={6}>
            <T v="tiny" color={C.textDim}>
              {t('Privacidade')}
            </T>
          </Pressable>
        </Row>
        {reason === 'hands' && FREE.handsPerDay ? (
          <Pressable onPress={close} hitSlop={6}>
            <T v="small" style={{ textAlign: 'center' }} color={C.muted}>
              {t('Continuar grátis · amanhã tens mais {n} mãos', { n: FREE.handsPerDay })}
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PlanCard({ active, onPress, title, price, was, sub, badge }: { active: boolean; onPress: () => void; title: string; price: string; was?: string; sub: string; badge?: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tap('select');
        onPress();
      }}
      style={{
        borderRadius: R.lg,
        borderWidth: 2,
        borderColor: active ? C.accent : C.border,
        backgroundColor: active ? C.accentSoft : C.surface,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? C.accent : C.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
        {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <T v="h2">{title}</T>
          {badge ? (
            <View style={{ backgroundColor: C.accent, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
              <T style={{ color: C.accentInk, fontSize: 11, fontWeight: '800', fontFamily: ff(800) }}>{badge}</T>
            </View>
          ) : null}
        </Row>
        <T v="small">{sub}</T>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {was ? (
          <T v="tiny" style={{ textDecorationLine: 'line-through' }} accessibilityLabel={t('Em vez de {price}', { price: was })}>
            {was}
          </T>
        ) : null}
        <T v="mono">{price}</T>
      </View>
    </Pressable>
  );
}

/** What happens during the trial, so starting it doesn't feel like a leap. */
function TrialSteps({ days, after, store }: { days: number; after: string; store: string }) {
  const steps: { icon: IconName; when: string; what: string }[] = [
    { icon: 'lock-open', when: t('Hoje'), what: t('Desbloqueias tudo. Não pagas nada hoje.') },
    { icon: 'calendar-outline', when: t('Dia {n}', { n: days }), what: t('Começa a subscrição: {price}. Se cancelares antes, não pagas nada.', { price: after }) },
    { icon: 'settings-outline', when: t('Quando quiseres'), what: t('Cancelas nas definições da {store}.', { store }) },
  ];
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: 14, gap: 12, borderWidth: 1, borderColor: C.border }}>
      {steps.map((s) => (
        <Row key={s.when} gap={12} style={{ alignItems: 'flex-start' }}>
          <Ionicons name={s.icon} size={16} color={C.accent} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <T v="small" style={{ color: C.text, fontWeight: '800', fontFamily: ff(800) }}>
              {s.when}
            </T>
            <T v="small">{s.what}</T>
          </View>
        </Row>
      ))}
    </View>
  );
}
