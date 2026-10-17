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
