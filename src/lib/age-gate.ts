// The US age-range check on iOS (see age-gate-core.ts for the rules). At each cold launch Apple says
// whether the law covers this account, and only then the system sheet asks to share the age range
// (iOS may answer from its own cache). Kept in memory only; nothing is stored, logged, tracked or sent.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { OLD_AGE_KEY, shouldAsk, verdictOf, type AgeVerdict } from './age-gate-core';

/** This run of the app only. */
let adultThisRun = false;

type AgeRange = typeof import('expo-age-range');

function ageRange(): AgeRange | null {
  // Web, Expo Go builds without the module, Android (the Play side is not wired yet): no check.
  if (Platform.OS !== 'ios' || !requireOptionalNativeModule('ExpoAgeRange')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-age-range') as AgeRange;
  } catch {
    return null;
  }
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((_, no) => {
    timer = setTimeout(() => no(Object.assign(new Error('timeout'), { code: 'ERR_TIMEOUT' })), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/** Apple's answer about this account, in at most 5 s. */
async function eligibility(m: AgeRange): Promise<boolean | null | 'error'> {
  try {
    return await timeout(m.isEligibleForAgeFeaturesAsync(), 5_000);
  } catch {
    return 'error';
  }
}

/** Is the app allowed to open? Asks only where Apple says the law applies. */
export async function checkAge(): Promise<AgeVerdict> {
  const m = ageRange();
  // The first prototype's flag, if a test build left one.
  void AsyncStorage.removeItem(OLD_AGE_KEY).catch(() => {});
  if (!m) return 'not-required';
  if (adultThisRun) return 'adult';
  if (!shouldAsk(await eligibility(m))) return 'not-required';
  return askAge();
}

/** The system sheet (also «Tentar de novo»). The person answers it, so the limit is generous. */
export async function askAge(): Promise<AgeVerdict> {
  const m = ageRange();
  if (!m) return 'not-required';
  let v: AgeVerdict;
  try {
    const r = await timeout(m.requestAgeRangeAsync({ threshold1: 18 }), 120_000);
    v = verdictOf({ lowerBound: r.lowerBound, upperBound: r.upperBound });
  } catch (e) {
    v = verdictOf({ code: String((e as { code?: unknown })?.code ?? '') });
  }
  if (v === 'adult') adultThisRun = true;
  return v;
}
