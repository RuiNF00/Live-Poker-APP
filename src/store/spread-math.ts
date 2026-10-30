// The spread behind every "how sure is this" in the app: the standard
// deviation per hour of cash results, and the multipliers for a 95% range
// when the spread itself comes from a handful of sessions. Pure, so it can be tested.

/**
 * Standard deviation per hour of session results xᵢ over hᵢ hours, around a
 * win rate `rate` worked out from the same sessions. A session of h hours has
 * variance h·σ², so E[Σ(xᵢ − rate·hᵢ)²] = σ²·(H − Σhᵢ²/H): dividing by H alone
 * (what the app did) reads σ too small, by √(1 − 1/n) with n equal sessions
 * (18% with 3 sessions, 5% with 10). Sessions with 0 hours add nothing.
 */
export function sdPerHour(xs: number[], hrs: number[], rate: number): number {
  let ss = 0;
  let h = 0;
  let h2 = 0;
  xs.forEach((x, i) => {
    if (!(hrs[i] > 0)) return;
    ss += (x - rate * hrs[i]) ** 2;
    h += hrs[i];
    h2 += hrs[i] ** 2;
  });
  const df = h - (h ? h2 / h : 0);
  return df > 0 ? Math.sqrt(ss / df) : 0;
}

/** Student's t at 97.5% (a two-sided 95% range) for 1–30 degrees of freedom; 1.96 beyond. */
const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

/**
 * The multiplier for a 95% range when σ is estimated from n sessions: 1.96
 * assumes σ is known, which with 3 sessions makes the range less than half as
 * wide as it should be. Between 30 and ∞ it eases to 1.96 in 1/df.
 */
export function t95(n: number): number {
  const df = Math.max(1, Math.floor(n) - 1);
  if (df <= T975.length) return T975[df - 1];
  return 1.96 + (T975[T975.length - 1] - 1.96) * (T975.length / df);
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
export function normCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** z with normCdf(z) = p, by bisection (0 < p < 1). */
export function normInv(p: number): number {
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
