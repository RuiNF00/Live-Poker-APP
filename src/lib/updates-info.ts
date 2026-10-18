// What this launch knows about over-the-air updates. Web (and the Node tests)
// has none, so expo-updates stays out of the web bundle; phones read it from
// expo-updates (updates-info.native.ts).

export interface UpdatesInfo {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  isEmergencyLaunch: boolean;
  emergencyLaunchReason: string | null;
  updateId: string | null;
  channel: string | null;
}

export const Updates: UpdatesInfo = {
  isEnabled: false,
  isEmbeddedLaunch: true,
  isEmergencyLaunch: false,
  emergencyLaunchReason: null,
  updateId: null,
  channel: null,
};
