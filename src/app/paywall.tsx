import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { annualSavingPct, FREE, LEGAL, PAYWALL_COPY, perMonth, PLANS, PRO_FEATURES, type PaywallReason, type PlanId } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { Row, T, tap } from '@/components/ui';
import { BRAND, C, R, ff } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function money(n: number) {
  return `${n.toFixed(2).replace('.', ',')} US$`;
}

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { reason = 'generic' } = useLocalSearchParams<{ reason?: PaywallReason }>();
  const { plans, purchase, restore, isPro } = usePro();
  const [sel, setSel] = useState<PlanId>('annual');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const copy = PAYWALL_COPY[reason] ?? PAYWALL_COPY.generic;

  const monthly = plans.find((p) => p.id === 'monthly');
  const annual = plans.find((p) => p.id === 'annual');
  const saving = monthly && annual ? annualSavingPct(monthly.price, annual.price) : annualSavingPct(PLANS.monthly.price, PLANS.annual.price);
  const chosen = sel === 'annual' ? annual : monthly;
  const trial = chosen?.trialDays ?? 0;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onBuy = async () => {
    tap('medium');
    setBusy('buy');
    const res = await purchase(sel);
    setBusy(null);
    if (res === 'ok') close();
    else if (res === 'unavailable') Alert.alert('Ainda não disponível', 'As subscrições ainda não estão ativas nesta versão.');
    else if (res === 'error') Alert.alert('Não deu para concluir', 'Não foi cobrado nada. Tenta outra vez daqui a pouco.');
  };

  const onRestore = async () => {
    setBusy('restore');
    const ok = await restore();
    setBusy(null);
    if (ok) close();
    else Alert.alert('Sem compras', 'Não encontrámos nenhuma subscrição nesta conta da loja.');
  };

  const store = Platform.OS === 'android' ? 'Google Play' : 'App Store';
  const after = chosen ? `${chosen.priceString} por ${PLANS[sel].period}` : '';

  if (isPro)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <Ionicons name="checkmark-circle" size={56} color={C.accent} />
        <T v="h1">Já és Pro</T>
        <Pressable onPress={close}>
          <T v="body" color={C.accent}>
            Voltar
          </T>
        </Pressable>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 24, gap: 18 }}>
        <Pressable accessibilityLabel="Fechar" onPress={close} hitSlop={12} style={{ alignSelf: 'flex-start', padding: 4 }}>
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
        </View>

        <View style={{ gap: 12 }}>
          {PRO_FEATURES.map((f) => (
            <Row key={f.title} gap={12} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={f.icon as IconName} size={18} color={C.accent} />
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
                title="Anual"
                price={annual.priceString + ' / ano'}
                sub={`${money(perMonth(annual.price))} por mês`}
                badge={annual.trialDays ? `${annual.trialDays} dias grátis · poupa ${saving}%` : `Poupa ${saving}%`}
              />
            ) : null}
            {monthly ? <PlanCard active={sel === 'monthly'} onPress={() => setSel('monthly')} title="Mensal" price={monthly.priceString + ' / mês'} sub="Cancela quando quiseres" /> : null}
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
            <T style={{ color: C.accentInk, fontSize: 17, fontWeight: '800', fontFamily: ff(800) }}>{trial ? `Experimentar ${trial} dias grátis` : 'Subscrever Pro'}</T>
          )}
        </Pressable>
        <T v="tiny" style={{ textAlign: 'center', lineHeight: 15 }}>
          {trial ? `Grátis durante ${trial} dias, depois ${after}. ` : after ? `${after}. ` : ''}
          Renova automaticamente até cancelares nas definições da {store}, pelo menos 24 horas antes do fim do período.
        </T>
        <Row style={{ justifyContent: 'center' }} gap={18}>
          <Pressable onPress={onRestore} disabled={!!busy} hitSlop={6}>
            <T v="tiny" color={C.textDim}>
              {busy === 'restore' ? 'A restaurar…' : 'Restaurar compras'}
            </T>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(LEGAL.terms)} hitSlop={6}>
            <T v="tiny" color={C.textDim}>
              Termos
            </T>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacy)} hitSlop={6}>
            <T v="tiny" color={C.textDim}>
              Privacidade
            </T>
          </Pressable>
        </Row>
        {reason === 'hands' && FREE.handsPerDay ? (
          <Pressable onPress={close} hitSlop={6}>
            <T v="small" style={{ textAlign: 'center' }} color={C.muted}>
              Continuar grátis · amanhã tens mais {FREE.handsPerDay} mãos
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PlanCard({ active, onPress, title, price, sub, badge }: { active: boolean; onPress: () => void; title: string; price: string; sub: string; badge?: string }) {
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
      <T v="mono">{price}</T>
    </Pressable>
  );
}
