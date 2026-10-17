// How slow this machine is right now against the laptop the perf budgets were
// measured on, so a busy CI runner doesn't fail a budget the code still meets.

/** The calibration loop on the machine the budgets were measured on (17 Oct 2026). */
const CALIBRATION_MS = 65;

/** Best of 5: sorting and round-tripping 200,000 numbers, the same kind of work as the app's. */
function calibrate(): number {
  let best = Infinity;
  for (let k = 0; k < 5; k++) {
    let x = 1;
    const a: number[] = [];
    for (let i = 0; i < 200000; i++) a.push((x = (x * 16807) % 2147483647));
    const t0 = performance.now();
    a.sort((p, q) => p - q);
    JSON.parse(JSON.stringify(a));
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

/** 1 on the reference laptop or faster; 2 on a machine twice as slow. */
export function slowness(): number {
  return Math.max(1, calibrate() / CALIBRATION_MS);
}
