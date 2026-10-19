import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { annualSavingPct, featuresFor, priceLike, FREE, freeVsPro, INVITE, PAYWALL_COPY, perMonth, PLANS, type PaywallReason, type PlanId } from '@/billing/plans';
import { invitePct } from '@/billing/disclosure';
import { chargeNoticeAt } from '@/billing/nudges';
import { buyNotice, restoreNotice, usePro } from '@/billing/pro';
import { inviteOfferPrice, LIVE } from '@/billing/purchases';
import { deferTrial } from '@/billing/trial-moments';
import { LegalLink, LegalLinks } from '@/components/LegalLinks';
import { useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { Button, IconButton, Pill, Row, T, tap, type IconName } from '@/components/ui';
import { locale, t } from '@/i18n';
import { track } from '@/lib/events';
import { notice } from '@/lib/notice';
import { savedInviteOffer, type InviteOffer } from '@/lib/referrals';
import { useStore } from '@/store/store';
import { C, R, S, SHADOW, ff } from '@/theme';

const trialEnd = (days: number) => new Date(Date.now() + days * 86_400_000).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

export default function Paywall() {
  const insets = useSafeAreaInsets();
  // Small phones (SE, mini): drop the hero icon so the plans show without scrolling.
  const win = useWindowDimensions();
  // Short screens and large text both: the plans stay above the fold.
  const compact = win.height < 760 || win.fontScale > 1.3;
  // Most iPhones (844-874 pt): without the icon and with only the feature this paywall is about,
  // both plans sit above the footer (Store, 19 Oct: the monthly card was half under it at 844).
  const medium = !compact && win.height < 900;
  // Very short screens (320×568): the fixed footer keeps the billed price, the button and
  // the disclosures; Restore and the other ways out move to the end of the scroll.
  const short = win.height < 640;
  // Short screen and text at 160%+: the fixed footer took ~3/4 of the screen and left the plans a sliver.
  // It scrolls after the plans instead, the button still with the terms and links right under it.
  const inline = short && win.fontScale >= 1.6;
  const { reason = 'generic' } = useLocalSearchParams<{ reason?: PaywallReason }>();
  const { plans, plansFailed, reloadPlans, purchase, restore, isPro, paywallConfig, takeResume, refreshNudges } = usePro();
  const { hands } = useStore();
  const [sel, setSel] = useState<PlanId>('annual');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  // Only a player who was already Pro on arrival sees "Já és Pro"; Pro arriving here goes straight back.
  const [wasPro] = useState(isPro);
  const [sheet, ask] = useNotifySoftAsk();
  // The offering can replace the headline for an A/B test; the offer itself never changes.
  const copy = { ...(PAYWALL_COPY[reason] ?? PAYWALL_COPY.generic), ...paywallConfig.copy[reason] };
  const table = paywallConfig.layout === 'table';

  const monthly = plans.find((p) => p.id === 'monthly');
  const annual = plans.find((p) => p.id === 'annual');
  // Only from two store prices: never a saving against a price the store didn't give.
  const saving = monthly && annual ? annualSavingPct(monthly.price, annual.price) : null;
  // An offering without one of the plans still buys in one tap: the other one is chosen.
  const chosen = sel === 'annual' ? (annual ?? monthly) : (monthly ?? annual);
  const plan: PlanId = chosen?.id ?? sel;
  const trial = chosen?.trialDays ?? 0;

  // An invite discount still open: one line to where it's used, so it isn't missed here.
  const [inviteOffer, setInviteOffer] = useState<InviteOffer | null>(null);
  // On Google Play the % is the store offer's own (as on the invite screen); without it no figure is claimed.
  const invitePctShown = invitePct(Platform.OS === 'android' && LIVE, monthly?.price, inviteOfferPrice(plans)?.price, INVITE.pct);
  useEffect(() => {
    savedInviteOffer().then(setInviteOffer);
  }, []);

  // Prices failed earlier (offline at launch): try again now that the player is looking at them.
  useEffect(() => {
    if (plansFailed && !plans.length) reloadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // At the end of onboarding the trial can wait for the next live session, so its days are spent at the table.
  const deferable = reason === 'plan' && paywallConfig.defer;
  const later = () => {
    void deferTrial();
    track('onboarding_step', { step: 'defer', defer: true, offering: paywallConfig.offering });
    close();
  };
  const dismiss = () => {
    track('paywall_closed', { reason, plan: sel, offering: paywallConfig.offering, layout: paywallConfig.layout });
    takeResume();
    close();
  };
  // Closed any other way (swipe down): the tapped action must not run on a later, unrelated purchase.
  useEffect(() => () => void takeResume(), [takeResume]);

  // Pro arrived: straight back to the screen that was tapped, now unlocked, and finish what was tapped there.
  // Said out loud before closing, so a screen reader doesn't land back on the screen in silence.
  const unlocked = (said = t('Pro ativo')) => {
    AccessibilityInfo.announceForAccessibility(said);
    const then = takeResume();
    close();
    if (then) setTimeout(then, 350);
  };

  // Pro turning on while the paywall is open but not from a tap here (a restore that outlasted its wait,
  // Ask to Buy approved, a code redeemed): back to what was tapped, same as a purchase.
  const acting = useRef(false);
  useEffect(() => {
    if (isPro && !wasPro && !acting.current) unlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  const onBuy = async () => {
    if (acting.current) return;
    acting.current = true;
    setBusy('buy');
    const res = await purchase(plan, reason);
    setBusy(null);
    if (res !== 'ok') acting.current = false;
    if (res === 'ok') {
      // A trial just started: the day-5 reminder the timeline promised, asked once, over this screen.
      if (trial >= 3) {
        const ok = await ask({
          where: 'trial',
          title: t('Avisamos-te antes de cobrar'),
          preview: { title: t('O teste grátis acaba a {date}', { date: trialEnd(trial) }), body: t('Vês as mãos que registaste e o dia em que o teste acaba.') },
        });
        if (ok) refreshNudges();
      }
      return unlocked();
    }
    // Cancelled in the store sheet: stay here, nothing to say.
    if (res === 'pending') {
      // Ask to Buy or a card still being checked: nothing more to do here, Pro turns on by itself.
      notice(t('Compra pendente'), t('O Pro liga-se sozinho quando a {store} confirmar o pagamento.', { store }));
      takeResume();
      close();
    } else if (res === 'unavailable') notice(t('Não deu para ligar à {store}', { store }), t('Tenta outra vez.'));
    else buyNotice(res, store);
  };

  const onRestore = async () => {
    if (acting.current) return;
    acting.current = true;
    setBusy('restore');
    const res = await restore();
    setBusy(null);
    if (res !== 'ok') acting.current = false;
    if (res === 'ok') return unlocked(t('Compras restauradas'));
    restoreNotice(res, store);
  };

  const store = Platform.OS === 'android' ? 'Google Play' : 'App Store';
  const after = chosen ? t('{price} por {period}', { price: chosen.priceString, period: t(PLANS[plan].period) }) : '';

  const restoreLink = (
    <LegalLink role="button" onPress={onRestore} disabled={!!busy} color={busy === 'restore' ? C.accent : C.textDim} title={busy === 'restore' ? t('A restaurar…') : t('Restaurar compras')} />
  );
  // The renewal/trial terms and Terms + Privacy are disclosures: always in the footer next to the
  // button, on short screens too (App Store 3.1.2, Google Play). The rest can scroll on short screens.
  const disclosure = (
    <>
      {/* Same terms on both stores: renews by itself, cancelled in the store's settings at least 24 h before (App Store 3.1.2, Google Play). */}
      {chosen ? (
        <T v="tiny" style={{ textAlign: 'center' }}>
          {trial
            ? t('Sem cancelar, o teste grátis passa a {price} a {date} e renova automaticamente. Cancela quando quiseres nas definições da {store}, pelo menos 24 h antes.', { price: after, date: trialEnd(trial), store })
            : t('Renova automaticamente até cancelares nas definições da {store}, pelo menos 24 horas antes do fim do período.', { store })}
        </T>
      ) : null}
      {short ? <LegalLinks /> : <LegalLinks>{restoreLink}</LegalLinks>}
    </>
  );
  const shieldLine = compact ? null : (
    <Row gap={6} style={{ justifyContent: 'center' }}>
      <Ionicons name="shield-checkmark" size={14} color={C.good} />
      <T v="small" color={C.text}>
        {Platform.OS === 'android' ? t('Cancela quando quiseres na Google Play, em Pagamentos e subscrições.') : t('Cancela quando quiseres na {store}.', { store })}
      </T>
    </Row>
  );
  const extras = (
    <>
      {short ? <Row style={{ justifyContent: 'center' }}>{restoreLink}</Row> : null}
      {(reason === 'hands' || reason === 'handsLive') && FREE.handsPerDay ? (
        <Row style={{ justifyContent: 'center', paddingTop: 2 }} gap={S.lg}>
          <Pressable onPress={() => router.replace('/invite')} accessibilityRole="button" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="gift-outline" size={14} color={C.accent} />
            <T v="small" color={C.accent} style={{ fontFamily: ff(700) }}>
              {t('Convidar um amigo')}
            </T>
          </Pressable>
          <Pressable onPress={dismiss} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <T v="small" color={C.muted}>
              {t('Agora não')}
            </T>
          </Pressable>
        </Row>
      ) : null}
    </>
  );

  const footer = (
    <View style={inline ? { gap: S.xs } : { paddingHorizontal: S.gutter, paddingTop: short ? S.sm : S.md, paddingBottom: insets.bottom + S.sm, gap: short ? S.xs : S.sm, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
      {busy === 'buy' ? (
        // The button stays, busy and saying what is happening, so the focus doesn't jump.
        <Button title={t('A abrir a {store}…', { store })} disabled onPress={onBuy} />
      ) : (
        <>
          {/* The billed amount is the most visible price element; the trial comes after it (App Store 3.1.2). */}
          {after ? (
            <T v="small" style={{ textAlign: 'center' }}>
              <T v="h3">{after}</T>
              {trial ? ' ' + t('depois de {days} dias grátis', { days: trial }) : ''}
            </T>
          ) : null}
          <Button title={trial ? t('Continuar') : t('Subscrever Pro')} iconRight="chevron-forward" disabled={!chosen || !!busy} onPress={onBuy} />
        </>
      )}
      {deferable && trial ? (
        <Pressable onPress={later} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <T v="small" color={C.accent} style={{ fontFamily: ff(700) }}>
            {t('Prefiro começar na próxima sessão')}
          </T>
        </Pressable>
      ) : null}
      {short ? null : shieldLine}
      {disclosure}
      {short ? null : extras}
    </View>
  );

  if (isPro && wasPro) return <AlreadyPro onDone={close} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.gutter, paddingBottom: S.xl, gap: short ? S.sm : compact ? S.lg : S.xl }}>
        <IconButton name="close" label={t('Fechar')} onPress={dismiss} />

        <View style={{ gap: short ? S.sm : S.md }}>
          {compact || medium ? null : (
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...SHADOW, shadowColor: C.accent, shadowOpacity: 0.45 }}>
              <Ionicons name="flash" size={28} color={C.accentInk} />
            </View>
          )}
          <T v={compact ? 'h1' : 'title'}>{copy.title}</T>
          <T v="callout">{copy.body}</T>
          {hands.length >= 3 && reason !== 'welcome' && !medium ? <Pill icon="albums" label={t('{n} mãos no teu caderno', { n: hands.length })} /> : null}
        </View>

        {table && !compact && !medium ? <FreeVsPro /> : null}

        {/* Small phones skip the feature list so both plans fit above the footer. */}
        <View style={{ gap: S.sm, display: compact || table ? 'none' : 'flex' }}>
          {featuresFor(reason).slice(0, medium ? 1 : undefined).map(({ feature: f, highlight }) => (
            <Row key={f.key} gap={S.md} style={{ minHeight: 40 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: highlight ? C.accent : C.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={f.icon as IconName} size={18} color={highlight ? C.accentInk : C.accent} />
              </View>
              <T v="h3" style={{ flex: 1 }}>
                {f.title}
              </T>
              <T v="small" style={{ flexShrink: 1, textAlign: 'right' }}>
                {f.body}
              </T>
            </Row>
          ))}
        </View>

        {plans.length === 0 && plansFailed ? (
          <View style={{ alignItems: 'center', gap: S.md, paddingVertical: S.lg }}>
            <T v="callout" style={{ textAlign: 'center' }}>
              {t('Não deu para ligar à {store}. Tenta outra vez.', { store })}
            </T>
            <Button kind="secondary" size="md" icon="refresh" title={t('Tentar outra vez')} onPress={reloadPlans} />
          </View>
        ) : plans.length === 0 ? (
          // Bounded by the store call's deadline: this turns into the retry above, never spins for good.
          <Row gap={S.sm} style={{ justifyContent: 'center', paddingVertical: S.lg }}>
            <ActivityIndicator color={C.accent} />
            <T v="small">{t('A carregar os preços da {store}…', { store })}</T>
          </Row>
        ) : (
          <View style={{ gap: short ? S.sm : S.sm + 2 }}>
            {/* The subscription's name on the purchase screen (App Store 3.1.2 / Schedule 2). */}
            <T v="label">Sweatbook Pro</T>
            {inviteOffer ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/invite')}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="gift" size={18} color={C.accent} />
                <T v="small" color={C.text} style={{ flex: 1 }}>
                  {invitePctShown !== null ? t('Tens {pct}% no primeiro mês pelo convite', { pct: invitePctShown }) : t('Tens um desconto no primeiro mês do Pro')}
                </T>
                <T v="small" color={C.accent}>
                  {t('Usar')}
                </T>
              </Pressable>
            ) : null}
            {annual ? (
              <PlanCard
                active={plan === 'annual'}
                onPress={() => setSel('annual')}
                title={t('Anual')}
                big={annual.priceString}
                unit={t('/ano')}
                line={t('{price} por mês', { price: priceLike(annual.priceString, perMonth(annual.price, annual.currency), annual.currency, locale) })}
                tags={[annual.trialDays ? t('{days} dias grátis', { days: annual.trialDays }) : null, saving !== null && saving > 0 ? '−' + saving + '%' : null]}
                compact={compact}
              />
            ) : null}
            {monthly ? <PlanCard active={plan === 'monthly'} onPress={() => setSel('monthly')} title={t('Mensal')} big={monthly.priceString} unit={t('/mês')} line={t('Cancela quando quiseres')} compact={compact} /> : null}
            {trial ? <TrialSteps days={trial} after={after} /> : null}
          </View>
        )}
        {inline ? footer : null}
        {short ? <View style={{ gap: S.sm }}>{extras}</View> : null}
      </ScrollView>

      {inline ? null : footer}
      {sheet}
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
  const bigText = useWindowDimensions().fontScale >= 1.6;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Sweatbook Pro, ${title}, ${big} ${unit}, ${line}`}
      onPress={() => {
        tap('select');
        onPress();
      }}
      style={({ pressed }) => ({
        borderRadius: R.lg,
        borderWidth: 2,
        borderColor: active ? C.accent : C.border,
        backgroundColor: active ? C.accentSoft : C.surface,
        paddingHorizontal: compact ? S.md : S.lg,
        paddingVertical: compact ? S.sm : S.lg,
        gap: S.sm,
        opacity: pressed ? 0.9 : 1,
      })}>
      {compact ? (
        // Text at 160%+: the price goes under the name, or it squeezed the line to "16, 6…".
        <Row gap={S.sm} style={bigText ? { flexWrap: 'wrap' } : null}>
          <Radio active={active} />
          <View style={{ flex: 1, gap: 1 }}>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <T v="h3">{title}</T>
              {tags[0] ? <T style={{ color: C.textDim, fontSize: 12, fontFamily: ff(800), fontWeight: '800' }}>{tags[0]}</T> : null}
            </Row>
            {/* Wraps rather than clips: at 150% on 360 pt «Cancela quando quiseres» lost its end. */}
            <T v="tiny">
              {line}
            </T>
          </View>
          <Row gap={S.sm} style={bigText ? { width: '100%', paddingLeft: 30 } : null}>
            <T v="mono" numberOfLines={1}>
              {big}
            </T>
            <T v="tiny">{unit}</T>
          </Row>
        </Row>
      ) : (
        <>
      <Row gap={S.sm}>
        <Radio active={active} />
        <T v="h2" style={{ flex: 1 }}>
          {title}
        </T>
        {tags.filter(Boolean).map((tg, i) => (
          <View key={tg} style={{ backgroundColor: C.surface3, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
            <T style={{ color: C.text, fontSize: 12, fontFamily: ff(800), fontWeight: '800' }}>{tg}</T>
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
        <T v="small">
          {line}
        </T>
      </View>
        </>
      )}
    </Pressable>
  );
}

/** The "table" layout: what stays free and what Pro adds, side by side. */
function FreeVsPro() {
  const cell = (v: string | boolean, pro: boolean) =>
    typeof v === 'boolean' ? (
      <Ionicons name={v ? 'checkmark' : 'remove'} size={18} color={v ? (pro ? C.accent : C.text) : C.muted} accessibilityLabel={v ? t('Sim') : t('Não')} />
    ) : (
      <T v="mono" color={pro ? C.accent : C.text}>
        {v}
      </T>
    );
  return (
    <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
      <Row style={{ paddingHorizontal: S.md, paddingVertical: S.sm, backgroundColor: C.surface2 }}>
        <View style={{ flex: 1 }} />
        <T v="label" style={{ width: 56, textAlign: 'center' }}>
          {t('Grátis')}
        </T>
        <T v="label" color={C.accent} style={{ width: 56, textAlign: 'center' }}>
          Pro
        </T>
      </Row>
      {freeVsPro().map((r, i) => (
        <Row key={r.label} style={{ paddingHorizontal: S.md, minHeight: 44, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}>
          <T v="body" style={{ flex: 1 }}>
            {t(r.label)}
          </T>
          <View style={{ width: 56, alignItems: 'center' }}>{cell(r.free, false)}</View>
          <View style={{ width: 56, alignItems: 'center' }}>{cell(r.pro, true)}</View>
        </Row>
      ))}
    </View>
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
  // Real dates, the same ones the charge notice and the store use.
  const [now] = useState(() => Date.now());
  const end = now + days * 86_400_000;
  const day = (ts: number) => new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const steps: { icon: IconName; when: string; what: string }[] = [
    { icon: 'lock-open', when: t('Hoje'), what: t('Tudo desbloqueado. Nada a pagar.') },
    // The charge notice (nudges.ts, or the home card without notifications) keeps this promise.
    days >= 3
      ? { icon: 'notifications-outline', when: day(chargeNoticeAt(end)), what: t('Avisamos-te antes de cobrar.') }
      : { icon: 'close-circle-outline', when: t('Antes disso'), what: t('Cancela e não pagas nada.') },
    { icon: 'card-outline', when: day(end), what: t('Começa: {price}', { price: after }) },
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

/** Opened while already Pro (a stale link or a second tap): say so and go back. */
function AlreadyPro({ onDone }: { onDone: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xxl }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', ...SHADOW, shadowColor: C.accent, shadowOpacity: 0.45 }}>
        <Ionicons name="checkmark" size={40} color={C.accentInk} />
      </View>
      <T v="title" style={{ textAlign: 'center' }}>
        {t('Já és Pro')}
      </T>
      <Button title={t('Continuar')} onPress={onDone} style={{ alignSelf: 'stretch', marginTop: S.md }} />
    </View>
  );
}
