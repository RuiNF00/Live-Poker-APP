import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { annualSavingPct, featuresFor, formatPrice, FREE, LEGAL, PAYWALL_COPY, perMonth, PLANS, type PaywallReason, type PlanId } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { Button, IconButton, Pill, Row, T, tap, type IconName } from '@/components/ui';
import { locale, t } from '@/i18n';
import { useStore } from '@/store/store';
import { C, R, S, SHADOW, ff } from '@/theme';

export default function Paywall() {
  const insets = useSafeAreaInsets();
  // Small phones (SE, mini): drop the hero icon so the plans show without scrolling.
  const compact = useWindowDimensions().height < 760;
  const { reason = 'generic' } = useLocalSearchParams<{ reason?: PaywallReason }>();
  const { plans, purchase, restore, isPro } = usePro();
  const { hands } = useStore();
  const [sel, setSel] = useState<PlanId>('annual');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  // Set when Pro arrives on this screen (purchase or restore), to say what just unlocked.
  const [welcomed, setWelcomed] = useState(false);
  // Trial days started here, so the welcome can offer the day-5 reminder it promised.
  const [started, setStarted] = useState(0);
  const copy = PAYWALL_COPY[reason] ?? PAYWALL_COPY.generic;

  const monthly = plans.find((p) => p.id === 'monthly');
  const annual = plans.find((p) => p.id === 'annual');
  const saving = monthly && annual ? annualSavingPct(monthly.price, annual.price) : annualSavingPct(PLANS.monthly.price, PLANS.annual.price);
  const chosen = sel === 'annual' ? annual : monthly;
  const trial = chosen?.trialDays ?? 0;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onBuy = async () => {
    setBusy('buy');
    const res = await purchase(sel, reason);
    setBusy(null);
    if (res === 'ok') {
      setWelcomed(true);
      setStarted(trial);
    } else if (res === 'unavailable') Alert.alert(t('Ainda não disponível'), t('As subscrições ainda não estão ativas nesta versão.'));
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

  if (isPro) return <Unlocked reason={reason} welcomed={welcomed} trial={started} onDone={close} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.gutter, paddingBottom: S.xl, gap: compact ? S.lg : S.xl }}>
        <IconButton name="close" label={t('Fechar')} onPress={close} />

        <View style={{ gap: S.md }}>
          {compact ? null : (
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...SHADOW, shadowColor: C.accent, shadowOpacity: 0.45 }}>
              <Ionicons name="flash" size={28} color={C.accentInk} />
            </View>
          )}
          <T v={compact ? 'h1' : 'title'}>{copy.title}</T>
          <T v="callout">{copy.body}</T>
          {hands.length >= 3 && reason !== 'welcome' ? <Pill icon="albums" label={t('{n} mãos no teu caderno', { n: hands.length })} /> : null}
        </View>

        {/* Small phones skip the feature list so both plans fit above the footer. */}
        <View style={{ gap: S.sm, display: compact ? 'none' : 'flex' }}>
          {featuresFor(reason).map(({ feature: f, highlight }) => (
            <Row key={f.key} gap={S.md} style={{ minHeight: 40 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: highlight ? C.accent : C.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={f.icon as IconName} size={18} color={highlight ? C.accentInk : C.accent} />
              </View>
              <T v="h3" style={{ flex: 1 }}>
                {f.title}
              </T>
              <T v="small">{f.body}</T>
            </Row>
          ))}
        </View>

        {plans.length === 0 ? (
          <ActivityIndicator color={C.accent} />
        ) : (
          <View style={{ gap: S.sm + 2 }}>
            {annual ? (
              <PlanCard
                active={sel === 'annual'}
                onPress={() => setSel('annual')}
                title={t('Anual')}
                big={annual.priceString}
                unit={t('/ano')}
                line={t('{price} por mês', { price: formatPrice(perMonth(annual.price), annual.currency, locale) })}
                was={monthly ? formatPrice(monthly.price * 12, monthly.currency, locale) : undefined}
                tags={[annual.trialDays ? t('{days} dias grátis', { days: annual.trialDays }) : null, '−' + saving + '%']}
                compact={compact}
              />
            ) : null}
            {monthly ? <PlanCard active={sel === 'monthly'} onPress={() => setSel('monthly')} title={t('Mensal')} big={monthly.priceString} unit={t('/mês')} line={t('Cancela quando quiseres')} compact={compact} /> : null}
            {trial ? <TrialSteps days={trial} after={after} /> : null}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: S.gutter, paddingTop: S.md, paddingBottom: insets.bottom + S.sm, gap: S.sm, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
        {busy === 'buy' ? (
          <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : (
          <Button
            title={trial ? t('Começar {days} dias grátis', { days: trial }) : t('Subscrever Pro')}
            sub={trial ? t('Depois {after}', { after }) : after}
            disabled={!chosen || !!busy}
            onPress={onBuy}
          />
        )}
        <T v="tiny" style={{ textAlign: 'center' }}>
          {t('Renova automaticamente. Cancela na {store} até 24 h antes do fim do período.', { store })}
        </T>
        <Row style={{ justifyContent: 'center' }} gap={S.lg}>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(LEGAL.terms)} hitSlop={8}>
            <T v="tiny" color={C.textDim}>
              {t('Termos')}
            </T>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacy)} hitSlop={8}>
            <T v="tiny" color={C.textDim}>
              {t('Privacidade')}
            </T>
          </Pressable>
          <Pressable onPress={onRestore} disabled={!!busy} hitSlop={8}>
            <T v="tiny" color={C.textDim}>
              {t('Restaurar compras')}
            </T>
          </Pressable>
        </Row>
        {reason === 'hands' && FREE.handsPerDay ? (
          <Row style={{ justifyContent: 'center', paddingTop: 2 }} gap={S.lg}>
            <Pressable onPress={() => router.replace('/invite')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="gift-outline" size={14} color={C.accent} />
              <T v="small" color={C.accent} style={{ fontFamily: ff(700) }}>
                {t('Convidar um amigo')}
              </T>
            </Pressable>
            <Pressable onPress={close} hitSlop={8}>
              <T v="small" color={C.muted}>
                {t('Agora não')}
              </T>
            </Pressable>
          </Row>
        ) : null}
      </View>
    </View>
  );
}

function PlanCard({
  active,
  onPress,
  title,
  big,
  unit,
  line,
  was,
  tags = [],
  compact,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  big: string;
  unit: string;
  line: string;
  was?: string;
  tags?: (string | null)[];
  /** One row: radio, name and line on the left, price on the right. */
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${title}, ${big} ${unit}, ${line}`}
      onPress={() => {
        tap('select');
        onPress();
      }}
      style={({ pressed }) => ({
        borderRadius: R.lg,
        borderWidth: 2,
        borderColor: active ? C.accent : C.border,
        backgroundColor: active ? C.accentSoft : C.surface,
        padding: compact ? S.md : S.lg,
        gap: S.sm,
        opacity: pressed ? 0.9 : 1,
      })}>
      {compact ? (
        <Row gap={S.sm}>
          <Radio active={active} />
          <View style={{ flex: 1, gap: 1 }}>
            <Row gap={6}>
              <T v="h3">{title}</T>
              {tags[0] ? <T style={{ color: C.accent, fontSize: 12, fontFamily: ff(800), fontWeight: '800' }}>{tags[0]}</T> : null}
            </Row>
            <T v="tiny" numberOfLines={1}>
              {line}
            </T>
          </View>
          <T v="mono" numberOfLines={1}>
            {big}
          </T>
          <T v="tiny">{unit}</T>
        </Row>
      ) : (
        <>
      <Row gap={S.sm}>
        <Radio active={active} />
        <T v="h2" style={{ flex: 1 }}>
          {title}
        </T>
        {tags.filter(Boolean).map((tg, i) => (
          <View key={tg} style={{ backgroundColor: i === 0 ? C.accent : C.surface3, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
            <T style={{ color: i === 0 ? C.accentInk : C.text, fontSize: 12, fontFamily: ff(800), fontWeight: '800' }}>{tg}</T>
          </View>
        ))}
      </Row>
      <View style={{ paddingLeft: 30, gap: 2 }}>
        <Row gap={6} style={{ alignItems: 'flex-end' }}>
          <T v="monoL" numberOfLines={1} adjustsFontSizeToFit>
            {big}
          </T>
          <T v="small" style={{ paddingBottom: 3 }}>
            {unit}
          </T>
          {was ? (
            <T v="monoS" style={{ marginLeft: 'auto', paddingBottom: 4, textDecorationLine: 'line-through', color: C.muted }} accessibilityLabel={t('Em vez de {price}', { price: was })}>
              {was}
            </T>
          ) : null}
        </Row>
        <T v="small" numberOfLines={1}>
          {line}
        </T>
      </View>
        </>
      )}
    </Pressable>
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? C.accent : C.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
      {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} /> : null}
    </View>
  );
}

/** What happens during the trial, in three short lines. */
function TrialSteps({ days, after }: { days: number; after: string }) {
  const steps: { icon: IconName; when: string; what: string }[] = [
    { icon: 'lock-open', when: t('Hoje'), what: t('Tudo desbloqueado. 0 a pagar.') },
    // The day-5 reminder (nudges.ts) keeps this promise.
    days >= 3
      ? { icon: 'notifications-outline', when: t('Dia {n}', { n: days - 2 }), what: t('Avisamos-te antes de cobrar.') }
      : { icon: 'close-circle-outline', when: t('Antes disso'), what: t('Cancela e não pagas nada.') },
    { icon: 'card-outline', when: t('Dia {n}', { n: days }), what: t('Começa: {price}', { price: after }) },
  ];
  return (
    <View style={{ paddingHorizontal: 4, paddingTop: S.sm, gap: S.md }}>
      {steps.map((s, i) => (
        <Row key={s.when} gap={S.md}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? C.accentSoft : C.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={s.icon} size={14} color={i === 0 ? C.accent : C.textDim} />
          </View>
          <T v="h3" style={{ width: 92 }}>
            {s.when}
          </T>
          <T v="small" style={{ flex: 1 }}>
            {s.what}
          </T>
        </Row>
      ))}
    </View>
  );
}

function Unlocked({ reason, welcomed, trial, onDone }: { reason: PaywallReason; welcomed: boolean; trial: number; onDone: () => void }) {
  const { refreshNudges } = usePro();
  const [sheet, ask] = useNotifySoftAsk();
  const [reminder, setReminder] = useState(false);
  // Right after a trial starts: ask for the day-5 reminder the timeline promised.
  useEffect(() => {
    if (trial < 3) return;
    let live = true;
    const timer = setTimeout(async () => {
      const ok = await ask({
        title: t('Avisamos-te antes de cobrar'),
        preview: { title: t('Dia 5 do teu Pro'), body: t('Vês as mãos que registaste e o dia em que o teste acaba.') },
      });
      if (!live || !ok) return;
      setReminder(true);
      refreshNudges();
    }, 600);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [trial, ask, refreshNudges]);
  const line = !welcomed
    ? null
    : reason === 'hands'
      ? t('Toca em Guardar. A mão vai para o caderno.')
      : reason === 'story'
        ? t('Grava a tua voz. Sem marca de água.')
        : reason === 'stats'
          ? t('Filtros, salas e jogos abertos.')
          : reason === 'solver'
            ? t('Seleciona as mãos e exporta para o solver.')
            : t('Mãos sem limite, a partir de agora.');
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xxl }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...SHADOW, shadowColor: C.accent, shadowOpacity: 0.45 }}>
        <Ionicons name="checkmark" size={40} color={C.accentInk} />
      </View>
      <T v="title" style={{ textAlign: 'center' }}>
        {welcomed ? t('Bem-vindo ao Pro') : t('Já és Pro')}
      </T>
      {line ? (
        <T v="callout" style={{ textAlign: 'center' }}>
          {line}
        </T>
      ) : null}
      {reminder ? <Pill icon="notifications" label={t('Lembrete ativo')} /> : null}
      <Button title={reason === 'hands' && welcomed ? t('Voltar à mão') : t('Continuar')} onPress={onDone} style={{ alignSelf: 'stretch', marginTop: S.md }} />
      {sheet}
    </View>
  );
}
