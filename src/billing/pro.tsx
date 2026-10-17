// Who is Pro, and what the free plan has left today. The save/share rules
// plug into the app's gate (src/lib/gate.ts) and open the paywall when blocked.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { setGate } from '@/lib/gate';

import { canUse, pruneLog, remainingToday, type UsageEvent, type UsageKind } from './limits';
import { FREE, type PaywallReason, type PlanId } from './plans';
import * as store from './purchases';

const KEYS = { pro: 'rl.pro.v1', usage: 'rl.usage.v1' };

interface ProValue {
  isPro: boolean;
  plans: store.StorePlan[];
  /** Free hands left today; null when unlimited (Pro or no limit). */
  handsLeft: number | null;
  canSaveHand: () => boolean;
  canShare: () => boolean;
  record: (kind: UsageKind) => void;
  paywall: (reason?: PaywallReason) => void;
  purchase: (plan: PlanId) => Promise<store.BuyResult>;
  restore: () => Promise<boolean>;
}

const Ctx = createContext<ProValue | null>(null);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState<UsageEvent[]>([]);
  const [plans, setPlans] = useState<store.StorePlan[]>([]);

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
    return off;
  }, [setPro]);

  const record = useCallback((kind: UsageKind) => {
    setUsage((l) => {
      const next = pruneLog([...l, { kind, t: Date.now() }]);
      AsyncStorage.setItem(KEYS.usage, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const canSaveHand = useCallback(() => canUse(usage, 'hand', FREE.handsPerDay, isPro), [usage, isPro]);
  const canShare = useCallback(() => canUse(usage, 'share', FREE.sharesPerDay, isPro), [usage, isPro]);

  const paywall = useCallback((reason: PaywallReason = 'generic') => {
    router.push({ pathname: '/paywall', params: { reason } });
  }, []);

  const purchase = useCallback(
    async (id: PlanId) => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) return 'unavailable' as const;
      const res = await store.buy(plan);
      if (res === 'ok') setPro(true);
      return res;
    },
    [plans, setPro],
  );

  const restore = useCallback(async () => {
    const ok = await store.restore();
    if (ok) setPro(true);
    return ok;
  }, [setPro]);

  // Install the free-plan rules behind the app's save/share seam (src/lib/gate.ts).
  // Refs keep the check current without re-installing it on every change.
  const live = useRef({ usage, isPro, record, paywall });
  useEffect(() => {
    live.current = { usage, isPro, record, paywall };
  }, [usage, isPro, record, paywall]);
  useEffect(() => {
    setGate(async (action, { hand, hands }) => {
      const { usage: log, isPro: pro, record: rec, paywall: open } = live.current;
      if (action === 'save') {
        if (hands.some((h) => h.id === hand.id)) return true; // editing never counts
        if (!canUse(log, 'hand', FREE.handsPerDay, pro)) {
          open('hands');
          return false;
        }
        rec('hand');
        return true;
      }
      if (action === 'share') {
        if (hand.shareId) return true; // re-sharing an existing link is free
        if (!canUse(log, 'share', FREE.sharesPerDay, pro)) {
          open('shares');
          return false;
        }
        rec('share');
        return true;
      }
      // Stories are free with a watermark; the story screen asks usePro() for voice/no watermark.
      return true;
    });
    return () => setGate(async () => true);
  }, []);

  const handsLeft = isPro ? null : remainingToday(usage, 'hand', FREE.handsPerDay);

  const value = useMemo(
    () => ({ isPro, plans, handsLeft, canSaveHand, canShare, record, paywall, purchase, restore }),
    [isPro, plans, handsLeft, canSaveHand, canShare, record, paywall, purchase, restore],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePro(): ProValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePro outside ProProvider');
  return v;
}
