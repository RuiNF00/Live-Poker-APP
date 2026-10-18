// Everything the root layout runs that draws nothing on the first frame:
// reminders, syncs, the cloud copy, the lock screen and widget bridges. The
// root loads this module after that frame, so its code (and what it pulls in:
// swaps, staking, festival offers, backup) isn't evaluated before "Nova mão"
// can be tapped.

import { reloadAppAsync } from 'expo';
import { useLocales } from 'expo-localization';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';

import { AutoCloudBackup } from '@/components/CloudBackup';
import { BackerLiveSync } from '@/components/staking/BackerLive';
import { BackerPageSync } from '@/components/staking/BackerPage';
import { SettleReminder } from '@/components/staking/SettleReminder';
import { SwapReminder } from '@/components/swaps/SwapReminder';
import { SwapSettleReminder } from '@/components/swaps/SwapSettleReminder';
import { TrialFollowUp } from '@/components/TrialFollowUp';
import { languageChanged } from '@/i18n';
import { HomeWidgetSync } from '@/lib/home-widget';
import { SessionLockScreen } from '@/lib/lock-screen';
import { MonthRecapSync } from '@/lib/month-recap';
import { NotifyPolicySync } from '@/lib/notify-gate';
import { ReviewSync } from '@/lib/review';

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
  return (
    <>
      <AutoCloudBackup />
      <BackerLiveSync />
      <BackerPageSync />
      <SessionLockScreen />
      <HomeWidgetSync />
      <SwapReminder />
      <SwapSettleReminder />
      <TrialFollowUp />
      <MonthRecapSync />
      <SettleReminder />
      <NotifyPolicySync />
      <ReviewSync />
      <LanguageWatch />
    </>
  );
}
