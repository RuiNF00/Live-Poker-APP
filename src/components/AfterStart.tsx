// Everything the root layout runs that draws nothing on the first frame:
// reminders, syncs, the cloud copy, the lock screen and widget bridges. The
// root loads this module after that frame, so its code (and what it pulls in:
// swaps, staking, festival offers, backup) isn't evaluated before "Nova mão"
// can be tapped.

import React from 'react';

import { AutoCloudBackup } from '@/components/CloudBackup';
import { BackerLiveSync } from '@/components/staking/BackerLive';
import { BackerPageSync } from '@/components/staking/BackerPage';
import { SettleReminder } from '@/components/staking/SettleReminder';
import { SwapReminder } from '@/components/swaps/SwapReminder';
import { SwapSettleReminder } from '@/components/swaps/SwapSettleReminder';
import { TrialFollowUp } from '@/components/TrialFollowUp';
import { HomeWidgetSync } from '@/lib/home-widget';
import { SessionLockScreen } from '@/lib/lock-screen';
import { MonthRecapSync } from '@/lib/month-recap';
import { NotifyPolicySync } from '@/lib/notify-gate';
import { ReviewSync } from '@/lib/review';

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
    </>
  );
}
