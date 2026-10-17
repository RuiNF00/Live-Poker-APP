// No UI of its own: opens the trial paywall once, when the first live session
// has been closed (never at the table), and the one-time "trial off" or "trial
// over" screen. See src/billing/trial-moments.ts.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { currentTrial } from '@/billing/nudges-sync';
import { usePro } from '@/billing/pro';
import { deferState, markNotice, markSessionOffer, seenNotices, sessionStartOffer, trialNotice, withLastTrial } from '@/billing/trial-moments';
import { claimState } from '@/lib/referrals';
import { useStore } from '@/store/store';

export function TrialFollowUp() {
  const { isPro, trialDays, paywall } = usePro();
  const { ready, activeSession, sessions } = useStore();
  const sessionId = activeSession?.id ?? null;

  // The session that was live a moment ago. When it closes (saved with an end, not deleted),
  // the offer slides over its summary: the hands and the result are in, nothing is being typed.
  const [wasLive, setWasLive] = useState<string | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  if (sessionId !== wasLive) {
    if (!sessionId && wasLive) setEnded(wasLive);
    setWasLive(sessionId);
  }
  const closedId = ended && sessions.some((s) => s.id === ended && s.endedAt) ? ended : null;
  useEffect(() => {
    if (!closedId || isPro || trialDays < 1) return;
    let live = true;
    const timer = setTimeout(async () => {
      const [s, claim] = await Promise.all([deferState(), claimState()]);
      // An invite reward is already on its way: no trial pitch on top of it.
      const invited = !!claim && (claim.result === 'ok' || claim.result === 'already');
      if (!live || invited || !sessionStartOffer(s, { isPro, trialDays })) return;
      await markSessionOffer(s);
      if (live) paywall('sessionStart');
    }, 1200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [closedId, isPro, trialDays, paywall]);

  // Checked on launch and each time the app comes back (a trial is cancelled in the phone's settings).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setTick((n) => n + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    // Not at the table: the screen waits for the next open after the session.
    if (!ready || sessionId) return;
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
  }, [ready, isPro, tick, sessionId]);

  return null;
}
