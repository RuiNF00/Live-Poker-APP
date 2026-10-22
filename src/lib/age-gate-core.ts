// The US age-range check (Texas today; Utah and Louisiana in 2027: Apple's Declared Age Range). Pure,
// so it can be tested; the native calls are in age-gate.ts. Nothing of the answer is stored: Texas
// §121.055 wants what comes from the store deleted after verification, so the result lives only in
// memory for this run of the app, and nothing of it leaves the phone.

/** Where the first prototype kept a "confirmed adult" flag; removed at launch so test builds leave nothing. */
export const OLD_AGE_KEY = 'rl.age.v1';

export type AgeVerdict =
  /** Apple says the law doesn't apply here, or this iPhone can't tell (below iOS 26.2): no question asked. */
  | 'not-required'
  | 'adult'
  | 'minor'
  /** The person chose not to share. */
  | 'declined'
  /** Not signed in to an Apple account, no answer, or an error. */
  | 'unavailable';

/**
 * Apple's eligibility answer → ask or not. `false`: the law doesn't cover this account. `null`: iOS
 * below 26.2, where Apple can't say, so nobody is asked (asking there would ask everyone, everywhere).
 * An error or no answer isn't a yes either: only the people the law covers are ever asked, so this
 * launch asks nothing and the next cold launch asks Apple again.
 */
export function shouldAsk(eligible: boolean | null | 'error'): boolean {
  return eligible === true;
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
