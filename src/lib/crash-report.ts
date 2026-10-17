// Crash reports (Sentry, EU region): which line of our JS failed, in which
// version and OTA update, so a crash can be fixed the same day. Off when the
// build has no DSN (EXPO_PUBLIC_SENTRY_DSN) or the player turned it off in
// Definições → Os teus dados. Nothing personal is sent: see crash-scrub.ts.
//
// The SDK is loaded only when reports are on, so web and builds without a DSN
// never carry or run it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { variant } from '@/i18n';

import { loadSentry, wipeSentryCache } from './crash-sdk';
import { onEraseAll } from './erase-all';
import { scrubBreadcrumb, scrubEvent, TAGS, type CrashTag } from './crash-scrub';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN as string | undefined;
/** 'off' when the player turned reports off. Kept by erase-all (a choice, not data). */
export const CRASH_KEY = 'rl.crash.v1';

type SentryModule = typeof import('@sentry/react-native');
let sentry: SentryModule | null = null;
let started = false;

/** True when this build can send reports at all (a DSN, on a phone). */
export const crashReportsAvailable = !!DSN && Platform.OS !== 'web';

export async function crashReportsOn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CRASH_KEY)) !== 'off';
  } catch {
    return true;
  }
}

/** Called once at launch, before any screen. */
export async function startCrashReports(): Promise<void> {
  if (started || !crashReportsAvailable) return;
  started = true;
  if (!(await crashReportsOn())) return;
  try {
    const S = await loadSentry();
    if (!S) return;
    S.init({
      dsn: DSN,
      release: Constants.expoConfig?.version,
      dist: Updates.updateId ?? undefined,
      environment: Updates.channel || (__DEV__ ? 'development' : 'production'),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      attachScreenshot: false,
      attachViewHierarchy: false,
      // Sessions carry the native install id (did): the store consoles give the crash-free rate instead.
      enableAutoSessionTracking: false,
      beforeSend: (e) => scrubEvent(e),
      beforeBreadcrumb: (b) => scrubBreadcrumb(b),
    });
    S.setTags({ channel: Updates.channel ?? 'none', platform: Platform.OS, locale: variant });
    sentry = S;
  } catch {
    // A report that can't start must never stop the app.
  }
}

/** One of the allowed tags (pro, live_session…); ignored when reports are off. */
export function setCrashTag(key: CrashTag, value: string | boolean): void {
  if (!TAGS.includes(key)) return;
  sentry?.setTag(key, String(value));
}

/** The Settings switch. Off takes effect at once; on from the next launch. */
export async function setCrashReports(on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.removeItem(CRASH_KEY);
    else await AsyncStorage.setItem(CRASH_KEY, 'off');
  } catch {
    // Storage full: the switch stays as it was.
  }
  if (!on) await stopCrashReports();
}

/** Stops reporting now and drops anything still queued on disk, so nothing goes out later. */
async function stopCrashReports(): Promise<void> {
  if (sentry) {
    await sentry.close().catch(() => {});
    sentry = null;
  }
  wipeSentryCache();
}

// Erase-all: nothing queued from before may leave afterwards.
onEraseAll(stopCrashReports);
