// The US age-range check (Texas, Utah, Louisiana: Apple's Declared Age Range). Pure, so it can be
// tested; the native calls are in age-gate.ts. Only a "confirmed adult" flag and the day it was
// confirmed stay on the phone: never the range or the age, and nothing of it leaves the phone.

/** AsyncStorage key; "rl." so «Apagar todos os dados» removes it and the next launch asks again. */
export const AGE_KEY = 'rl.age.v1';
/** Asked again after a year, so a change in the rules or the account is picked up. */
export const RECHECK_MS = 365 * 24 * 3_600_000;

export type AgeVerdict =
  /** Apple says the law doesn't apply here, or this iPhone can't tell (below iOS 26.2): no question asked. */
  | 'not-required'
  | 'adult'
  | 'minor'
  /** The person chose not to share. */
  | 'declined'
  /** Not signed in to an Apple account, no answer, or an error. */
  | 'unavailable';

/** True while a confirmed-adult flag is stored and less than a year old. */
export function adultStillConfirmed(raw: string | null, now = Date.now()): boolean {
  if (!raw) return false;
  try {
    const v = JSON.parse(raw) as { adult?: unknown; at?: unknown };
    return v.adult === true && typeof v.at === 'number' && v.at <= now && now - v.at < RECHECK_MS;
  } catch {
    return false;
  }
}

export function adultRecord(now = Date.now()): string {
  return JSON.stringify({ adult: true, at: now });
}

/**
 * Apple's eligibility answer → ask or not. `false`: the law doesn't cover this account. `null`: iOS
 * below 26.2, where Apple can't say, so nobody is asked (asking there would ask everyone, everywhere).
 * An error or no answer is "unknown" in a place that may need it, so the question is asked.
 */
export function shouldAsk(eligible: boolean | null | 'error'): boolean {
  return eligible === true || eligible === 'error';
}

/** The age-range answer (or its error code) → what the app does. Only lowerBound ≥ 18 opens it. */
export function verdictOf(r: { lowerBound: number | null; upperBound?: number | null } | { code: string }): AgeVerdict {
  if ('code' in r) return r.code === 'ERR_AGE_RANGE_USER_DECLINED' ? 'declined' : 'unavailable';
  if (r.lowerBound != null && r.lowerBound >= 18) return 'adult';
  if (r.upperBound != null && r.upperBound < 18) return 'minor';
  return 'unavailable';
}

/** Whether the app opens for this verdict. Everything else shows the calm screen with «Tentar de novo». */
export const opens = (v: AgeVerdict): boolean => v === 'adult' || v === 'not-required';
