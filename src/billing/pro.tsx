// Who is Pro, and what the free plan has left today. Screens ask this
// context before saving or sharing, and open the paywall when they can't.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { devPro, localProFrom, TEST_BUILD_MARK } from './dev-pro';
import { DEFAULT_PAYWALL, type PaywallConfig } from './experiments';
import { rememberTrial, syncNudges } from './nudges-sync';
import { ONBOARDING_KEY } from './onboarding';
import { shouldOfferWelcome } from './offers';
import { cachedPro, canUse, proCache, pruneLog, remainingToday, type UsageEvent, type UsageKind } from './limits';
import { FREE, INVITE, type PaywallReason, type PlanId } from './plans';
import { deferState, markProEnded, markSessionOffer } from './trial-moments';
import * as store from './purchases';
import { setLiveSession } from '@/lib/attribution';
import { track } from '@/lib/events';
import { t } from '@/i18n';
import { notice } from '@/lib/notice';
import { activateInvite, claimState, newInviteOffer, type InviteOffer } from '@/lib/referrals';
import { shortDate } from '@/poker/format';
import { noteReviewBlocker, noteVisibleError } from '@/lib/review';
import { useOnline } from '@/lib/sync';
import { useStore } from '@/store/store';

/**
 * An invite discount, said once with the way to use it: received, never won. Nothing for a
 * player already on Pro (there's no first month left to discount).
 */
function announceInviteOffer(offer: InviteOffer, side: 'friend' | 'inviter') {
  track('invite_rewarded', { side, pct: INVITE.pct });
  const vars = { pct: INVITE.pct, date: shortDate(Date.parse(offer.until)) };
  const title = side === 'friend' ? t('{pct}% no primeiro mês do Pro', vars) : t('Um amigo guardou a primeira mão');
  const body =
    side === 'friend'
      ? t('Guardaste a primeira mão: tu e quem te convidou recebem {pct}% no primeiro mês do Pro. Dá para usar até {date}.', vars)
      : t('Recebem os dois {pct}% no primeiro mês do Pro. Dá para usar até {date}.', vars);
  if (Platform.OS === 'web') notice(title, body);
  else Alert.alert(title, body, [{ text: t('Agora não'), style: 'cancel' }, { text: t('Ver desconto'), onPress: () => router.push('/invite') }]);
}

const KEYS = { pro: 'rl.pro.v1', usage: 'rl.usage.v1', welcome: 'rl.offer.welcome.v1' };

interface ProValue {
  isPro: boolean;
  plans: store.StorePlan[];
  /** The store couldn't be reached for prices; `reloadPlans` tries again. */
  plansFailed: boolean;
  reloadPlans: () => void;
  /** Layout and copy from the RevenueCat offering (A/B tests without a release). */
  paywallConfig: PaywallConfig;
  /** Free hands left today; null when unlimited (Pro or no limit). */
  handsLeft: number | null;
  /** Free trial days this player can still start on the annual plan (0 = none). */
  trialDays: number;
  canSaveHand: () => boolean;
  record: (kind: UsageKind, props?: Record<string, string | number | boolean>) => void;
  /** Opens the paywall. `then` runs after a purchase or restore there, so the tapped action happens without tapping again. */
  paywall: (reason?: PaywallReason, then?: () => void) => void;
  /** The paywall takes the pending `then` (once) when Pro arrives, or drops it when closed. */
  takeResume: () => (() => void) | null;
  purchase: (plan: PlanId, reason?: PaywallReason, replacing?: string) => Promise<store.BuyResult>;
  /** The store couldn't charge the last renewal and is retrying (Pro still on, in its grace period). */
  billingIssue: boolean;
  restore: () => Promise<store.RestoreResult>;
  /** Re-plan the trial and come-back notifications (after the player allows them). */
  refreshNudges: () => void;
}

const Ctx = createContext<ProValue | null>(null);
const DEV_PRO = devPro();
// Kept in the bundle (and the log) of a test build, so the pre-upload check can find it.
if (TEST_BUILD_MARK) console.info(TEST_BUILD_MARK);
/** Test-iPhone build only (dev-pro.ts); never written to the cached Pro flag, so turning it off removes Pro at once. */
export const LOCAL_PRO = localProFrom(process.env.EXPO_PUBLIC_LOCAL_PRO, store.LIVE);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [storePro, setIsPro] = useState(false);
  // Screenshot builds can force Pro (dev-pro.ts); always false in a store build.
  const isPro = storePro || DEV_PRO || LOCAL_PRO;
  const isProRef = useRef(isPro);
  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);
  const [usage, setUsage] = useState<UsageEvent[]>([]);
  const [plans, setPlans] = useState<store.StorePlan[]>([]);
  const [plansFailed, setPlansFailed] = useState(false);
  const [billingIssue, setBillingIssue] = useState(false);
  const checkBilling = useCallback(() => void store.getBillingIssue().then((b) => setBillingIssue(!!b)), []);
  const reloadPlans = useCallback(() => {
    setPlansFailed(false);
    store.getPlans().then((p) => (p ? setPlans(p) : setPlansFailed(true)));
  }, []);
  const [paywallConfig, setPaywallConfig] = useState<PaywallConfig>(DEFAULT_PAYWALL);
  const draftWaiting = !!useStore().draft;
  const trialDays = plans.find((p) => p.id === 'annual')?.trialDays ?? 0;

  const setPro = useCallback((v: boolean) => {
    setIsPro(v);
    // The store said Pro is gone where the last answer had it: remember when, for the one notice (TrialFollowUp).
    AsyncStorage.getItem(KEYS.pro)
      .then((prev) => (cachedPro(prev) && !v ? markProEnded() : undefined))
      .catch(() => {})
      .finally(() => AsyncStorage.setItem(KEYS.pro, proCache(v)).catch(() => {}));
  }, []);

  useEffect(() => {
    // Cached flag first so Pro works offline in the card room; the store corrects it.
    let storeAnswered = false;
    AsyncStorage.multiGet([KEYS.pro, KEYS.usage])
      .then(([[, pro], [, u]]) => {
        // Only until the store has spoken: a late cache read must not turn an expired Pro back on.
        if (cachedPro(pro) && !storeAnswered) setIsPro(true);
        if (u) setUsage(pruneLog(JSON.parse(u) as UsageEvent[]));
      })
      .catch(() => {});
    const off = store.configure((v) => {
      storeAnswered = true;
      setPro(v);
      checkBilling();
    });
    checkBilling();
    store.getIsPro().then((v) => {
      if (v === null) return;
      storeAnswered = true;
      setPro(v);
    });
    store.getPlans().then((p) => (p ? setPlans(p) : setPlansFailed(true)));
    store.getPaywallConfig().then(setPaywallConfig);
    return off;
  }, [setPro, checkBilling]);

  const record = useCallback((kind: UsageKind, props?: Record<string, string | number | boolean>) => {
    track(kind === 'hand' ? 'hand_saved' : 'share_created', props);
    // Came through an invite? The first saved hand books the discount for both players.
    if (kind === 'hand')
      activateInvite().then(async (granted) => {
        if (!granted || isProRef.current) return;
        const offer = await newInviteOffer({ force: true });
        if (offer) announceInviteOffer(offer, 'friend');
      });
    setUsage((l) => {
      const next = pruneLog([...l, { kind, t: Date.now() }]);
      AsyncStorage.setItem(KEYS.usage, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const canSaveHand = useCallback(() => canUse(usage, 'hand', FREE.handsPerDay, isPro), [usage, isPro]);

  const resume = useRef<(() => void) | null>(null);
  const takeResume = useCallback(() => {
    const f = resume.current;
    resume.current = null;
    return f;
  }, []);
  const paywall = useCallback((reason: PaywallReason = 'generic', then?: () => void) => {
    resume.current = then ?? null;
    if (reason === 'hands' || reason === 'handsLive') track('limit_hit', { reason });
    track('paywall_shown', { reason, trial: trialDays, offering: paywallConfig.offering, layout: paywallConfig.layout });
    void noteReviewBlocker('paywall');
    router.push({ pathname: '/paywall', params: { reason } });
  }, [trialDays, paywallConfig]);

  const purchase = useCallback(
    async (id: PlanId, reason: PaywallReason = 'generic', replacing?: string) => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) return 'unavailable' as const;
      const res = await store.buy(plan, replacing);
      if (res === 'error' || res === 'network') noteVisibleError();
      if (res === 'ok') {
        setPro(true);
        void noteReviewBlocker('bought');
        const props = { plan: id, reason, trial: plan.trialDays, offering: paywallConfig.offering, layout: paywallConfig.layout };
        // A hand waiting as a draft when buying: usually the one the free limit held back.
        track('purchase', { ...props, drafts: draftWaiting ? 1 : 0 });
        if (plan.trialDays) {
          track('trial_start', props);
          void rememberTrial(plan.trialDays);
        }
      }
      return res;
    },
    [plans, setPro, paywallConfig, draftWaiting],
  );

  const restore = useCallback(async () => {
    const res = await store.restore();
    if (res === 'ok') setPro(true);
    return res;
  }, [setPro]);

  const handsLeft = isPro ? null : remainingToday(usage, 'hand', FREE.handsPerDay);

  // Trial and come-back notifications follow the data: re-planned when it
  // changes and each time the app comes back to the front.
  const { hands, sessions, activeSession } = useStore();
  useEffect(() => setLiveSession(!!activeSession), [activeSession]);
  const [nudgeTick, setNudgeTick] = useState(0);
  const refreshNudges = useCallback(() => setNudgeTick((n) => n + 1), []);
  // The inviter hears about a friend's first hand on the next open, not only in Definições.
  const inviteNews = useCallback(() => {
    newInviteOffer().then((offer) => {
      if (offer && !isProRef.current) announceInviteOffer(offer, 'inviter');
    });
  }, []);
  useEffect(() => {
    inviteNews();
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      refreshNudges();
      checkBilling();
      inviteNews();
    });
    return () => sub.remove();
  }, [refreshNudges, inviteNews, checkBilling]);
  const annualPrice = plans.find((p) => p.id === 'annual')?.priceString ?? '';
  useEffect(() => {
    const timer = setTimeout(() => {
      void syncNudges({ now: Date.now(), isPro, annualPrice, hands, sessions, sessionActive: !!activeSession });
    }, 1500);
    return () => clearTimeout(timer);
  }, [nudgeTick, isPro, annualPrice, hands, sessions, activeSession]);

  const value = useMemo(
    () => ({ isPro, billingIssue, plans, plansFailed, reloadPlans, paywallConfig, handsLeft, trialDays, canSaveHand, record, paywall, takeResume, purchase, restore, refreshNudges }),
    [isPro, billingIssue, plans, plansFailed, reloadPlans, paywallConfig, handsLeft, trialDays, canSaveHand, record, paywall, takeResume, purchase, restore, refreshNudges],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePro(): ProValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePro outside ProProvider');
  return v;
}

/**
 * First run: a brand-new install (nothing logged, never onboarded) opens the
 * welcome flow once, over the hands list.
 */
export function useOnboarding() {
  const { ready, hands, sessions } = useStore();
  const fresh = ready && hands.length === 0 && sessions.length === 0;
  // On the web the screen comes from the server: offline (say, right after «Apagar tudo») it waits for the signal.
  const online = useOnline();
  const reachable = Platform.OS !== 'web' || online;
  useFocusEffect(
    useCallback(() => {
      if (!fresh || !reachable) return;
      let live = true;
      AsyncStorage.getItem(ONBOARDING_KEY)
        .then((seen) => {
          if (!live || seen) return;
          AsyncStorage.setItem(ONBOARDING_KEY, '{}').catch(() => {});
          router.push('/welcome');
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [fresh, reachable]),
  );
}

/**
 * The one unprompted trial offer, whichever comes first: on the hands list
 * after a first saved hand (here), or at the start of the first live session
 * (TrialFollowUp). See shouldOfferWelcome.
 */
export function useWelcomeOffer(handsSaved: number) {
  const { isPro, trialDays, paywall } = usePro();
  // At the table the offer waits: a live session gets it once it is closed (TrialFollowUp).
  const atTable = !!useStore().activeSession;
  useFocusEffect(
    useCallback(() => {
      if (isPro || atTable || handsSaved < 1 || trialDays < 1) return;
      let live = true;
      // Let the screen settle after coming back before sliding the offer up.
      const timer = setTimeout(async () => {
        const [shown, claim, atSession] = await Promise.all([AsyncStorage.getItem(KEYS.welcome).catch(() => null), claimState(), deferState()]);
        const invited = !!claim && (claim.result === 'ok' || claim.result === 'already');
        if (!live || !shouldOfferWelcome({ isPro, handsSaved, shown: shown === '1' || !!atSession?.shown, trialDays, invited })) return;
        await Promise.all([AsyncStorage.setItem(KEYS.welcome, '1').catch(() => {}), markSessionOffer(atSession)]);
        if (live) paywall('welcome');
      }, 700);
      return () => {
        live = false;
        clearTimeout(timer);
      };
    }, [isPro, atTable, handsSaved, trialDays, paywall]),
  );
}

/** What a restore found, in the same words wherever it is tapped. Offline is not "no purchases". */
/** What to say when a purchase didn't go through. Nothing for ok, cancelled, pending or a second tap; the caller says those. */
export function buyNotice(res: store.BuyResult, storeName: string) {
  if (res === 'network') notice(t('Sem resposta da {store}', { store: storeName }), t('Se a {store} confirmou o pagamento, o Pro liga-se sozinho. Se não, tenta outra vez.', { store: storeName }));
  else if (res === 'blocked') notice(t('Compras desligadas'), t('Este telemóvel não deixa fazer compras (Tempo de ecrã ou controlo parental).'));
  else if (res === 'owned') notice(t('Já tens esta compra'), t('Toca em Restaurar compras para ligar o Pro neste telemóvel.'));
  else if (res === 'error') notice(t('Não deu para concluir'), t('Não foi cobrado nada. Tenta outra vez daqui a pouco.'));
}

export function restoreNotice(res: store.RestoreResult, storeName: string) {
  if (res === 'ok') notice(t('Compras restauradas'), t('O teu Pro está ativo nesta conta da loja.'));
  else if (res === 'none') notice(t('Sem compras'), t('Não encontrámos nenhuma subscrição nesta conta da loja.'));
  else if (res === 'busy') return;
  else if (res === 'slow') notice(t('A {store} ainda está a responder', { store: storeName }), t('Se encontrar a compra, o Pro liga-se sozinho.'));
  else notice(t('Não deu para ligar à {store}', { store: storeName }), t('Verifica a rede e tenta outra vez daqui a pouco.'));
}
