// No UI of its own: opens the trial paywall when a player who deferred it
// starts a live session, and the one-time "trial off" or "trial over" screen.
// See src/billing/trial-moments.ts.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { currentTrial } from '@/billing/nudges-sync';
import { usePro } from '@/billing/pro';
import { deferState, markNotice, markSessionOffer, seenNotices, sessionStartOffer, trialNotice, withLastTrial } from '@/billing/trial-moments';
import { useStore } from '@/store/store';

export function TrialFollowUp() {
  const { isPro, trialDays, paywall } = usePro();
  const { ready, activeSession } = useStore();
  const sessionId = activeSession?.id ?? null;

  useEffect(() => {
    if (!sessionId || isPro || trialDays < 1) return;
    let live = true;
    // After the live screen has settled, so the paywall slides over it.
    const timer = setTimeout(async () => {
      const s = await deferState();
      if (!live || !s || !sessionStartOffer(s, { isPro, trialDays, now: Date.now() })) return;
      await markSessionOffer(s);
      if (live) paywall('sessionStart');
    }, 1200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [sessionId, isPro, trialDays, paywall]);

  // Checked on launch and each time the app comes back (a trial is cancelled in the phone's settings).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setTick((n) => n + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    const timer = setTimeout(async () => {
      const trial = await withLastTrial(await currentTrial());
      const kind = trialNotice(trial, await seenNotices(), { isPro, now: Date.now() });
      if (!live || !trial || !kind) return;
      await markNotice(kind, trial.start);
      if (live) router.push({ pathname: '/trial', params: { kind, end: String(trial.end) } });
    }, 2500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [ready, isPro, tick]);

  return null;
}
