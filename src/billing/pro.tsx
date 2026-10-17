// Who is Pro, and what the free plan has left today. Screens ask this
// context before saving or sharing, and open the paywall when they can't.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { devPro, localProFrom } from './dev-pro';
import { DEFAULT_PAYWALL, type PaywallConfig } from './experiments';
import { rememberTrial, syncNudges } from './nudges-sync';
import { ONBOARDING_KEY } from './onboarding';
import { shouldOfferWelcome } from './offers';
import { canUse, pruneLog, remainingToday, type UsageEvent, type UsageKind } from './limits';
import { FREE, type PaywallReason, type PlanId } from './plans';
import { deferState, markSessionOffer } from './trial-moments';
import * as store from './purchases';
import { setLiveSession } from '@/lib/attribution';
import { track } from '@/lib/events';
import { t } from '@/i18n';
import { notice } from '@/lib/notice';
import { activateInvite, claimState, newInviteDays } from '@/lib/referrals';
import { shortDate } from '@/poker/format';
import { noteReviewBlocker, noteVisibleError } from '@/lib/review';
import { useStore } from '@/store/store';

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
  record: (kind: UsageKind) => void;
  /** Opens the paywall. `then` runs after a purchase or restore there, so the tapped action happens without tapping again. */
  paywall: (reason?: PaywallReason, then?: () => void) => void;
  /** The paywall takes the pending `then` (once) when Pro arrives, or drops it when closed. */
  takeResume: () => (() => void) | null;
  purchase: (plan: PlanId, reason?: PaywallReason) => Promise<store.BuyResult>;
  restore: () => Promise<boolean>;
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
  const [usage, setUsage] = useState<UsageEvent[]>([]);
  const [plans, setPlans] = useState<store.StorePlan[]>([]);
  const [plansFailed, setPlansFailed] = useState(false);
  const reloadPlans = useCallback(() => {
    setPlansFailed(false);
    store.getPlans().then((p) => (p ? setPlans(p) : setPlansFailed(true)));
  }, []);
  const [paywallConfig, setPaywallConfig] = useState<PaywallConfig>(DEFAULT_PAYWALL);
  const draftWaiting = !!useStore().draft;
  const trialDays = plans.find((p) => p.id === 'annual')?.trialDays ?? 0;

  const setPro = useCallback((v: boolean) => {
    setIsPro(v);
    AsyncStorage.setItem(KEYS.pro, v ? '1' : '0').catch(() => {});
  }, []);

  useEffect(() => {
    // Cached flag first so Pro works offline in the card room; the store corrects it.
    AsyncStorage.multiGet([KEYS.pro, KEYS.usage])
      .then(([[, pro], [, u]]) => {
        if (pro === '1') setIsPro(true);
        if (u) setUsage(pruneLog(JSON.parse(u) as UsageEvent[]));
      })
      .catch(() => {});
    const off = store.configure(setPro);
    store.getIsPro().then((v) => v !== null && setPro(v));
    store.getPlans().then((p) => (p ? setPlans(p) : setPlansFailed(true)));
    store.getPaywallConfig().then(setPaywallConfig);
    return off;
  }, [setPro]);

  const record = useCallback((kind: UsageKind) => {
    track(kind === 'hand' ? 'hand_saved' : 'share_created');
    // Came through an invite? The first saved hand turns on both players' Pro days.
    if (kind === 'hand')
      activateInvite().then((granted) => {
        if (!granted) return;
        store.getIsPro().then((v) => v !== null && setPro(v));
        // Said the moment it happens, in the same words as the invite: days of Pro, nothing to win.
        notice(t('7 dias de Pro para os dois'), t('Guardaste a primeira mão: tu e quem te convidou têm Pro até {date}.', { date: shortDate(Date.now() + 7 * 86_400_000) }));
      });
    setUsage((l) => {
      const next = pruneLog([...l, { kind, t: Date.now() }]);
      AsyncStorage.setItem(KEYS.usage, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [setPro]);

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
    async (id: PlanId, reason: PaywallReason = 'generic') => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) return 'unavailable' as const;
      const res = await store.buy(plan);
      if (res === 'error') noteVisibleError();
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
    const ok = await store.restore();
    if (ok) setPro(true);
    return ok;
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
    newInviteDays().then((days) => {
      if (!days) return;
      store.getIsPro().then((v) => v !== null && setPro(v));
      notice(t('Um amigo guardou a primeira mão'), t('Têm os dois {n} dias de Pro.', { n: days }));
    });
  }, [setPro]);
  useEffect(() => {
    inviteNews();
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      refreshNudges();
      inviteNews();
    });
    return () => sub.remove();
  }, [refreshNudges, inviteNews]);
  const annualPrice = plans.find((p) => p.id === 'annual')?.priceString ?? '';
  useEffect(() => {
    const timer = setTimeout(() => {
      void syncNudges({ now: Date.now(), isPro, annualPrice, hands, sessions, sessionActive: !!activeSession });
    }, 1500);
    return () => clearTimeout(timer);
  }, [nudgeTick, isPro, annualPrice, hands, sessions, activeSession]);

  const value = useMemo(
    () => ({ isPro, plans, plansFailed, reloadPlans, paywallConfig, handsLeft, trialDays, canSaveHand, record, paywall, takeResume, purchase, restore, refreshNudges }),
    [isPro, plans, plansFailed, reloadPlans, paywallConfig, handsLeft, trialDays, canSaveHand, record, paywall, takeResume, purchase, restore, refreshNudges],
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
  useFocusEffect(
    useCallback(() => {
      if (!fresh) return;
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
    }, [fresh]),
  );
}

/**
 * The one unprompted trial offer, whichever comes first: on the hands list
 * after a first saved hand (here), or at the start of the first live session
 * (TrialFollowUp). See shouldOfferWelcome.
 */
export function useWelcomeOffer(handsSaved: number) {
  const { isPro, trialDays, paywall } = usePro();
  useFocusEffect(
    useCallback(() => {
      if (isPro || handsSaved < 1 || trialDays < 1) return;
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
    }, [isPro, handsSaved, trialDays, paywall]),
  );
}
