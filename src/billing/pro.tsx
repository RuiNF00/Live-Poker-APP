// Who is Pro, and what the free plan has left today. Screens ask this
// context before saving or sharing, and open the paywall when they can't.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_PAYWALL, type PaywallConfig } from './experiments';
import { rememberTrial, syncNudges } from './nudges-sync';
import { ONBOARDING_KEY } from './onboarding';
import { shouldOfferWelcome } from './offers';
import { canUse, pruneLog, remainingToday, type UsageEvent, type UsageKind } from './limits';
import { FREE, type PaywallReason, type PlanId } from './plans';
import * as store from './purchases';
import { track } from '@/lib/events';
import { activateInvite, claimState } from '@/lib/referrals';
import { useStore } from '@/store/store';

const KEYS = { pro: 'rl.pro.v1', usage: 'rl.usage.v1', welcome: 'rl.offer.welcome.v1' };

interface ProValue {
  isPro: boolean;
  plans: store.StorePlan[];
  /** Layout and copy from the RevenueCat offering (A/B tests without a release). */
  paywallConfig: PaywallConfig;
  /** Free hands left today; null when unlimited (Pro or no limit). */
  handsLeft: number | null;
  /** Free trial days this player can still start on the annual plan (0 = none). */
  trialDays: number;
  canSaveHand: () => boolean;
  canShare: () => boolean;
  record: (kind: UsageKind) => void;
  paywall: (reason?: PaywallReason) => void;
  purchase: (plan: PlanId, reason?: PaywallReason) => Promise<store.BuyResult>;
  restore: () => Promise<boolean>;
  /** Re-plan the trial and come-back notifications (after the player allows them). */
  refreshNudges: () => void;
}

const Ctx = createContext<ProValue | null>(null);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState<UsageEvent[]>([]);
  const [plans, setPlans] = useState<store.StorePlan[]>([]);
  const [paywallConfig, setPaywallConfig] = useState<PaywallConfig>(DEFAULT_PAYWALL);
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
    store.getPlans().then(setPlans);
    store.getPaywallConfig().then(setPaywallConfig);
    return off;
  }, [setPro]);

  const record = useCallback((kind: UsageKind) => {
    track(kind === 'hand' ? 'hand_saved' : 'share_created');
    // Came through an invite? The first saved hand turns on both players' Pro days.
    if (kind === 'hand')
      activateInvite().then((granted) => {
        if (granted) store.getIsPro().then((v) => v !== null && setPro(v));
      });
    setUsage((l) => {
      const next = pruneLog([...l, { kind, t: Date.now() }]);
      AsyncStorage.setItem(KEYS.usage, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [setPro]);

  const canSaveHand = useCallback(() => canUse(usage, 'hand', FREE.handsPerDay, isPro), [usage, isPro]);
  const canShare = useCallback(() => canUse(usage, 'share', FREE.sharesPerDay, isPro), [usage, isPro]);

  const paywall = useCallback((reason: PaywallReason = 'generic') => {
    if (reason === 'hands' || reason === 'shares') track('limit_hit', { reason });
    track('paywall_shown', { reason, trial: trialDays, offering: paywallConfig.offering, layout: paywallConfig.layout });
    router.push({ pathname: '/paywall', params: { reason } });
  }, [trialDays, paywallConfig]);

  const purchase = useCallback(
    async (id: PlanId, reason: PaywallReason = 'generic') => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) return 'unavailable' as const;
      const res = await store.buy(plan);
      if (res === 'ok') {
        setPro(true);
        const props = { plan: id, reason, trial: plan.trialDays, offering: paywallConfig.offering, layout: paywallConfig.layout };
        track('purchase', props);
        if (plan.trialDays) {
          track('trial_start', props);
          void rememberTrial(plan.trialDays);
        }
      }
      return res;
    },
    [plans, setPro, paywallConfig],
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
  const [nudgeTick, setNudgeTick] = useState(0);
  const refreshNudges = useCallback(() => setNudgeTick((n) => n + 1), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refreshNudges());
    return () => sub.remove();
  }, [refreshNudges]);
  const annualPrice = plans.find((p) => p.id === 'annual')?.priceString ?? '';
  useEffect(() => {
    const timer = setTimeout(() => {
      void syncNudges({ now: Date.now(), isPro, annualPrice, hands, sessions, sessionActive: !!activeSession });
    }, 1500);
    return () => clearTimeout(timer);
  }, [nudgeTick, isPro, annualPrice, hands, sessions, activeSession]);

  const value = useMemo(
    () => ({ isPro, plans, paywallConfig, handsLeft, trialDays, canSaveHand, canShare, record, paywall, purchase, restore, refreshNudges }),
    [isPro, plans, paywallConfig, handsLeft, trialDays, canSaveHand, canShare, record, paywall, purchase, restore, refreshNudges],
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
          // It ends on the paywall, so the after-first-hand offer would be a second one: skip it.
          AsyncStorage.multiSet([[ONBOARDING_KEY, '{}'], [KEYS.welcome, '1']]).catch(() => {});
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
 * The one unprompted trial offer: on the hands list, after the player saved a
 * first hand and came back from its replay. See shouldOfferWelcome.
 */
export function useWelcomeOffer(handsSaved: number) {
  const { isPro, trialDays, paywall } = usePro();
  useFocusEffect(
    useCallback(() => {
      if (isPro || handsSaved < 1 || trialDays < 1) return;
      let live = true;
      // Let the screen settle after coming back before sliding the offer up.
      const timer = setTimeout(async () => {
        const [shown, claim] = await Promise.all([AsyncStorage.getItem(KEYS.welcome).catch(() => null), claimState()]);
        const invited = !!claim && (claim.result === 'ok' || claim.result === 'already');
        if (!live || !shouldOfferWelcome({ isPro, handsSaved, shown: shown === '1', trialDays, invited })) return;
        await AsyncStorage.setItem(KEYS.welcome, '1').catch(() => {});
        if (live) paywall('welcome');
      }, 700);
      return () => {
        live = false;
        clearTimeout(timer);
      };
    }, [isPro, handsSaved, trialDays, paywall]),
  );
}
