// Who is Pro, and what the free plan has left today. Screens ask this
// context before saving or sharing, and open the paywall when they can't.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { devPro, localProFrom } from './dev-pro';
import { DEFAULT_PAYWALL, type PaywallConfig } from './experiments';
import { rememberTrial, syncNudges } from './nudges-sync';
import { ONBOARDING_KEY } from './onboarding';
import { shouldOfferWelcome } from './offers';
import { cachedPro, canUse, proCache, pruneLog, remainingToday, type UsageEvent, type UsageKind } from './limits';
import { invitePct } from './disclosure';
import { FREE, INVITE, type PaywallReason, type PlanId } from './plans';
import { deferState, markProEnded, markSessionOffer } from './trial-moments';
import * as store from './purchases';
import { useLockScreenUp } from '@/components/AppLock';
import { setLiveSession } from '@/lib/attribution';
import { OFFER_WAIT_MS, restoreOffer, welcomeStep } from '@/lib/restore-offer';
import { track } from '@/lib/events';
import { t } from '@/i18n';
import { notice } from '@/lib/notice';
import { activateInvite, claimState, newInviteOffer, type InviteOffer } from '@/lib/referrals';
import { shortDate } from '@/poker/format';
import { noteReviewBlocker, noteVisibleError } from '@/lib/review';
import { useStore } from '@/store/store';

/**
 * An invite discount, said once with the way to use it: received, never won. Nothing for a
 * player already on Pro (there's no first month left to discount). On Google Play the % is the
 * store offer's own, as on the paywall and the invite screen; without it no figure is claimed.
 */
function announceInviteOffer(offer: InviteOffer, side: 'friend' | 'inviter', plans: store.StorePlan[]) {
  const pct = invitePct(Platform.OS === 'android' && store.LIVE, plans.find((p) => p.id === 'monthly')?.price, store.inviteOfferPrice(plans)?.price, INVITE.pct);
  track('invite_rewarded', { side, pct: pct ?? INVITE.pct });
  const vars = { pct: pct ?? 0, date: shortDate(Date.parse(offer.until)) };
  const title = side === 'friend' ? (pct !== null ? t('{pct}% no primeiro mês do Pro', vars) : t('Desconto no primeiro mês do Pro')) : t('Um amigo guardou a primeira mão');
  const body =
    side === 'friend'
      ? pct !== null
        ? t('Guardaste a primeira mão: tu e quem te convidou recebem {pct}% no primeiro mês do Pro. Dá para usar até {date}.', vars)
        : t('Guardaste a primeira mão: tu e quem te convidou recebem um desconto no primeiro mês do Pro. Dá para usar até {date}.', vars)
      : pct !== null
        ? t('Recebem os dois {pct}% no primeiro mês do Pro. Dá para usar até {date}.', vars)
        : t('Recebem os dois um desconto no primeiro mês do Pro. Dá para usar até {date}.', vars);
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
  // The invite notice reads the store's prices as they are when it shows.
  const plansRef = useRef(plans);
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);
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
        if (offer) announceInviteOffer(offer, 'friend', plansRef.current);
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
    if (res === 'ok' || res === 'lifetime') setPro(true);
    return res;
  }, [setPro]);

  const handsLeft = isPro ? null : remainingToday(usage, 'hand', FREE.handsPerDay);

  // Trial and come-back notifications follow the data: re-planned when it
  // changes and each time the app comes back to the front.
  const { hands, sessions, activeSession, settings } = useStore();
  // «Lembretes» switched off or on in Settings: the come-back reminder already planned follows it.
  const tipsOn = settings.notify?.tips !== false;
  useEffect(() => setLiveSession(!!activeSession), [activeSession]);
  const [nudgeTick, setNudgeTick] = useState(0);
  const refreshNudges = useCallback(() => setNudgeTick((n) => n + 1), []);
  // The inviter hears about a friend's first hand on the next open, not only in Definições.
  // Not over the app lock (the alert would sit on top of it): the news waits for the unlock.
  const lockUp = useLockScreenUp();
  const lockRef = useRef(lockUp);
  useEffect(() => {
    lockRef.current = lockUp;
  }, [lockUp]);
  const inviteNews = useCallback(() => {
    if (lockRef.current) return;
    newInviteOffer().then((offer) => {
      if (offer && !isProRef.current) announceInviteOffer(offer, 'inviter', plansRef.current);
    });
  }, []);
  useEffect(() => {
    if (!lockUp) inviteNews();
  }, [lockUp, inviteNews]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      refreshNudges();
      checkBilling();
      // After the lock has had its turn to come up on resume.
      setTimeout(inviteNews, 1000);
    });
    return () => sub.remove();
  }, [refreshNudges, inviteNews, checkBilling]);
  const annualPrice = plans.find((p) => p.id === 'annual')?.priceString ?? '';
  useEffect(() => {
    const timer = setTimeout(() => {
      void syncNudges({ now: Date.now(), isPro, annualPrice, hands, sessions, sessionActive: !!activeSession });
    }, 1500);
    return () => clearTimeout(timer);
  }, [nudgeTick, isPro, annualPrice, hands, sessions, activeSession, tipsOn]);

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
 * welcome flow once, over the hands list. On a reinstall with a cloud copy the
 * offer to restore it comes first: accepted, no welcome (restore-offer).
 */
export function useOnboarding() {
  const { ready, hands, sessions } = useStore();
  const fresh = ready && hands.length === 0 && sessions.length === 0;
  const offer = useSyncExternalStore(restoreOffer.subscribe, restoreOffer.get);
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    if (!fresh || offer !== 'unknown') return;
    const id = setTimeout(() => setWaitedOut(true), OFFER_WAIT_MS);
    return () => clearTimeout(id);
  }, [fresh, offer]);
  const open = welcomeStep(offer, waitedOut) === 'open';
  useFocusEffect(
    useCallback(() => {
      if (!fresh || !open) return;
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
    }, [fresh, open]),
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
  // Never over the app lock: the paywall would sit on top of it (as in TrialFollowUp). It waits for the unlock.
  const lockUp = useLockScreenUp();
  useFocusEffect(
    useCallback(() => {
      if (isPro || atTable || lockUp || handsSaved < 1 || trialDays < 1) return;
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
    }, [isPro, atTable, lockUp, handsSaved, trialDays, paywall]),
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
  // The one-time Pro is no subscription: said as what it is.
  else if (res === 'lifetime') notice(t('Compras restauradas'), t('O teu Pro para sempre está ativo nesta conta da loja.'));
  else if (res === 'none') notice(t('Sem compras'), t('Não encontrámos nenhuma compra do Pro nesta conta da loja.'));
  else if (res === 'busy') return;
  else if (res === 'slow') notice(t('A {store} ainda está a responder', { store: storeName }), t('Se encontrar a compra, o Pro liga-se sozinho.'));
  else notice(t('Não deu para ligar à {store}', { store: storeName }), t('Verifica a rede e tenta outra vez daqui a pouco.'));
}
