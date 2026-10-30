// Everything the root layout runs that draws nothing on the first frame:
// reminders, syncs, the cloud copy, the lock screen and widget bridges. The
// root loads this module after that frame, so its code (and what it pulls in:
// swaps, staking, festival offers, backup) isn't evaluated before "Nova mão"
// can be tapped.

import { reloadAppAsync } from 'expo';
import { useLocales } from 'expo-localization';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';

import { BackerPageSync } from '@/components/staking/BackerPage';
import { preloadSvg } from '@/components/svg';
import { SwapSettleReminder } from '@/components/swaps/SwapSettleReminder';
import { TrialFollowUp } from '@/components/TrialFollowUp';
import { languageChanged } from '@/i18n';
import { HomeWidgetSync } from '@/lib/home-widget';
import { SessionLockScreen } from '@/lib/lock-screen';
import { MonthRecapSync } from '@/lib/month-recap';
import { NotifyPolicySync } from '@/lib/notify-gate';
import { ReviewSync } from '@/lib/review';

// Every use of CloudBackup.tsx is lazy, so it stays one chunk off the first frame.
const AutoCloudBackup = React.lazy(() => import('@/components/CloudBackup').then((m) => ({ default: m.AutoCloudBackup })));
// The reminders bring the swap and staking sheets with them: they load after the first frame too.
const SwapReminder = React.lazy(() => import('@/components/swaps/SwapReminder').then((m) => ({ default: m.SwapReminder })));
const SettleReminder = React.lazy(() => import('@/components/staking/SettleReminder').then((m) => ({ default: m.SettleReminder })));
const BackerLiveSync = React.lazy(() => import('@/components/staking/BackerLive').then((m) => ({ default: m.BackerLiveSync })));

/**
 * Android changes the app's language (Settings › Apps › Sweatbook › Language) without restarting
 * it, and every string, amount and date was fixed at launch: back in the app, it starts again in the
 * new language. Everything was already written on the way out (store.tsx flushes in the background).
 */
function LanguageWatch() {
  // Told by the system when the language changes (useLocales listens for it).
  const locales = useLocales();
  useEffect(() => {
    if (Platform.OS === 'android' && languageChanged(locales)) reloadAppAsync('language changed').catch(() => {});
  }, [locales]);
  return null;
}

export default function AfterStart() {
  // Web: the charts and share cards draw with svg, which is not in the launch chunk.
  useEffect(() => {
    void preloadSvg();
  }, []);
  return (
    <>
      <React.Suspense fallback={null}>
        <AutoCloudBackup />
        <SwapReminder />
        <SettleReminder />
        <BackerLiveSync />
      </React.Suspense>
      <BackerPageSync />
      <SessionLockScreen />
      <HomeWidgetSync />
      <SwapSettleReminder />
      <TrialFollowUp />
      <MonthRecapSync />
      <NotifyPolicySync />
      <ReviewSync />
      <LanguageWatch />
    </>
  );
}
