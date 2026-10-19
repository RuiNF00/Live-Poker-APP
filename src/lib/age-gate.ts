// The US age-range check on iOS (see age-gate-core.ts for the rules). One call at launch: a stored
// "confirmed adult" skips everything; otherwise Apple says whether the law covers this account, and
// only then the system sheet asks to share the age range. Nothing here is logged, tracked or sent.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { adultRecord, adultStillConfirmed, AGE_KEY, shouldAsk, verdictOf, type AgeVerdict } from './age-gate-core';

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
export async function checkAge(now = Date.now()): Promise<AgeVerdict> {
  const m = ageRange();
  if (!m) return 'not-required';
  if (adultStillConfirmed(await AsyncStorage.getItem(AGE_KEY).catch(() => null), now)) return 'adult';
  if (!shouldAsk(await eligibility(m))) return 'not-required';
  return askAge(now);
}

/** The system sheet (also «Tentar de novo»). The person answers it, so the limit is generous. */
export async function askAge(now = Date.now()): Promise<AgeVerdict> {
  const m = ageRange();
  if (!m) return 'not-required';
  let v: AgeVerdict;
  try {
    const r = await timeout(m.requestAgeRangeAsync({ threshold1: 18 }), 120_000);
    v = verdictOf({ lowerBound: r.lowerBound, upperBound: r.upperBound });
  } catch (e) {
    v = verdictOf({ code: String((e as { code?: unknown })?.code ?? '') });
  }
  if (v === 'adult') await AsyncStorage.setItem(AGE_KEY, adultRecord(now)).catch(() => {});
  return v;
}
