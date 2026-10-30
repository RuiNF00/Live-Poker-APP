// Smallest and largest value of lists that grow with the history (every hand, every session).
// Math.min(...list) hands each value to the call as an argument, and engines cap those (about
// 125 000 in V8, which a long history of hands plus sessions reaches): past it the call throws
// and the screen with it. These loop instead. Infinity / -Infinity when every list is empty.

export function minOf(...lists: readonly (readonly number[])[]): number {
  let m = Infinity;
  for (const l of lists) for (const x of l) if (x < m) m = x;
  return m;
}

export function maxOf(...lists: readonly (readonly number[])[]): number {
  let m = -Infinity;
  for (const l of lists) for (const x of l) if (x > m) m = x;
  return m;
}
