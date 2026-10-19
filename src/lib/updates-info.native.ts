// Phones: the over-the-air update facts from expo-updates (see updates-info.ts).
import * as U from 'expo-updates';

import type { UpdatesInfo } from './updates-info';

export type { UpdatesInfo };

export const Updates: UpdatesInfo = {
  isEnabled: U.isEnabled,
  isEmbeddedLaunch: U.isEmbeddedLaunch,
  isEmergencyLaunch: U.isEmergencyLaunch,
  emergencyLaunchReason: U.emergencyLaunchReason ?? null,
  updateId: U.updateId ?? null,
  channel: U.channel ?? null,
};
