// Over-the-air updates (expo-updates + EAS Update, set up in app.json): a new
// JS bundle is downloaded at launch and used from the next cold start, so the
// app never reloads in the middle of a hand. If a downloaded update can't
// launch, expo-updates falls back to the bundle inside the build by itself;
// `npm run ota:rollback` sends every phone back to it.

import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/** "1.0.0" for the bundle inside the build, "1.0.0 · a1b2c3d4" once an update runs. For support and bug reports. */
export function versionLabel(): string {
  const v = Constants.expoConfig?.version ?? '?';
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.updateId) return v;
  return `${v} · ${Updates.updateId.slice(0, 8)}`;
}

/** Why this launch fell back to the bundle inside the build, if it did (a broken update). */
export function emergencyLaunch(): string | null {
  return Updates.isEmergencyLaunch ? (Updates.emergencyLaunchReason ?? 'unknown') : null;
}
