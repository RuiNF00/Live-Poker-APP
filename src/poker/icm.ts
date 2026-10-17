// Deal-making at a final table: ICM (Malmuth–Harville) and chip-chop equities.

/** ICM equity of each stack for the given payouts (1st, 2nd, …). Exact, for up to ~12 players. */
export function icm(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const pays = payouts.slice(0, n);
  const out = new Array<number>(n).fill(0);
  const total = stacks.reduce((a, b) => a + b, 0);
  if (!total) return stacks.map(() => pays.reduce((a, b) => a + b, 0) / n);
  // memo[mask] = probability that exactly the players in `mask` have already finished above the rest.
  const memo = new Map<number, number>([[0, 1]]);
  const order: number[] = [0];
  const seen = new Set([0]);
  for (let qi = 0; qi < order.length; qi++) {
    const mask = order[qi];
    const p = memo.get(mask)!;
    const place = popcount(mask);
    if (place >= pays.length) continue;
    let left = total;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) left -= stacks[i];
    if (left <= 0) continue;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i) || stacks[i] <= 0) continue;
      const q = (p * stacks[i]) / left;
      out[i] += q * pays[place];
      const next = mask | (1 << i);
      memo.set(next, (memo.get(next) ?? 0) + q);
      if (!seen.has(next)) {
        seen.add(next);
        order.push(next);
      }
    }
  }
  return out;
}

function popcount(x: number) {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** Chip chop: everyone locks the lowest remaining payout, the rest is split by chips. */
export function chipChop(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const pays = payouts.slice(0, n);
  while (pays.length < n) pays.push(0);
  const pool = pays.reduce((a, b) => a + b, 0);
  const floor = Math.min(...pays);
  const total = stacks.reduce((a, b) => a + b, 0) || 1;
  return stacks.map((s) => floor + ((pool - floor * n) * s) / total);
}

// ── In the replayer: payout presets, the ICM price of a call, risk premium and PKO bounties ──

export type PayoutPreset = 'satellite' | 'flat' | 'standard' | 'top';

/** A typical live final table (% of the pool, 1st to 9th); deeper fields follow a power law. */
const FT_BASE = [26, 17, 12.5, 9.5, 7.5, 6, 5, 4.5, 4];
/** How steep each preset is against the standard curve; a satellite pays every seat the same. */
const GAMMA: Record<PayoutPreset, number> = { satellite: 0, flat: 0.91, standard: 1, top: 1.2 };

/** Payout shares (sum 1) for `places` paid places. */
export function payoutPreset(preset: PayoutPreset, places: number): number[] {
  const k = Math.max(1, Math.floor(places));
  const base = Array.from({ length: k }, (_, i) => (k <= FT_BASE.length ? FT_BASE[i] : 1 / Math.pow(i + 1, 1.1)));
  const tilted = base.map((b) => Math.pow(b, GAMMA[preset]));
  const sum = tilted.reduce((a, b) => a + b, 0);
  return tilted.map((x) => x / sum);
}

/** ICM equities when one stack may be at zero: the busted player takes the next place down. */
function icmAfter(stacks: number[], payouts: number[]): number[] {
  const alive = stacks.map((s, i) => (s > 0 ? i : -1)).filter((i) => i >= 0);
  const out = new Array<number>(stacks.length).fill(0);
  const eq = icm(alive.map((i) => stacks[i]), payouts.slice(0, alive.length));
  alive.forEach((i, k) => (out[i] = eq[k]));
  stacks.forEach((s, i) => {
    if (s <= 0) out[i] = payouts[alive.length] ?? 0;
  });
  return out;
}

export interface IcmCall {
  /** Equity needed by chips alone: pot odds. */
  chipEq: number;
  /** Equity needed once prize money is counted. */
  icmEq: number;
  /** icmEq − chipEq: the extra equity the payouts ask for. */
  riskPremium: number;
  /** Hero's $ equity after folding, after calling and winning, after calling and losing. */
  evFold: number;
  evWin: number;
  evLose: number;
}

/**
 * The ICM price of calling `call` into `pot` (all the chips in the middle that hero can win,
 * villain's bet included). `stacks` are the chips behind right now. Folding hands the pot to villain.
 */
export function icmCall(o: { stacks: number[]; payouts: number[]; hero: number; villain: number; pot: number; call: number }): IcmCall {
  const { stacks, payouts, hero, villain, pot } = o;
  const call = Math.min(o.call, stacks[hero]);
  const fold = stacks.slice();
  fold[villain] += pot;
  const win = stacks.slice();
  win[hero] += pot;
  const lose = stacks.slice();
  lose[hero] -= call;
  lose[villain] += pot + call;
  const evFold = icmAfter(fold, payouts)[hero];
  const evWin = icmAfter(win, payouts)[hero];
  const evLose = icmAfter(lose, payouts)[hero];
  const chipEq = call / (pot + call);
  const span = evWin - evLose;
  const icmEq = span > 0 ? Math.min(1, Math.max(0, (evFold - evLose) / span)) : chipEq;
  return { chipEq, icmEq, riskPremium: icmEq - chipEq, evFold, evWin, evLose };
}

/**
 * Risk premium of player i calling an all-in from player j (row i, column j), each risking the
 * smaller stack with nothing else in the pot. Chip-EV needs 50%; the premium is what ICM adds.
 */
export function riskPremiumMatrix(stacks: number[], payouts: number[]): number[][] {
  return stacks.map((_, i) =>
    stacks.map((_, j) => {
      if (i === j) return NaN;
      const eff = Math.min(stacks[i], stacks[j]);
      const s = stacks.slice();
      s[j] -= eff;
      return icmCall({ stacks: s, payouts, hero: i, villain: j, pot: eff, call: eff }).riskPremium;
    }),
  );
}

/**
 * PKO: the chips a bounty is worth when hero covers villain (Bounty Power model). Half the bounty
 * is paid in cash, and a starting stack is worth the buy-in, so chips per unit = startingStack / buyIn.
 */
export function pkoBountyChips(villainBounty: number, startingStack: number, buyIn: number, cashShare = 0.5): number {
  if (!(villainBounty > 0 && startingStack > 0 && buyIn > 0)) return 0;
  return (villainBounty * cashShare * startingStack) / buyIn;
}

/** Equity needed to call when winning also collects `bountyChips`. */
export function pkoRequiredEquity(call: number, potAfterCall: number, bountyChips: number): number {
  const total = potAfterCall + Math.max(0, bountyChips);
  return total > 0 ? call / total : 0;
}
