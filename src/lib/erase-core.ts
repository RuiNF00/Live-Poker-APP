// "Delete all my data": what stays on the phone afterwards. Pure, so it can be tested.

/**
 * Kept on purpose:
 * - the outbox and the share queue: they still hold the deletes of public links and
 *   the cloud copy, which go out when the signal is back;
 * - the free-plan usage log, the cached Pro flag and the trial date: purchases are
 *   tied to the store account, and erasing must not hand out new free hands;
 * - the install id and the referral state: otherwise erasing would claim invite
 *   rewards again.
 * None of these holds hands, sessions, notes or amounts.
 */
export const KEEP_KEYS = [
  'rl.outbox.v1',
  'sweatbook.share-queue.v1',
  'rl.usage.v1',
  'rl.pro.v1',
  'rl.trial.v1',
  'rl.install.v1',
  'rl.ref.v1',
  'rl.ref.reg.v1',
  'rl.claim.v1',
  'rl.first.v1',
  'rl.firsthand.v1',
];

/** Prefixes of every key the app writes. A new feature's key must start with one of them. */
export const APP_PREFIXES = ['rl.', 'sweatbook.', 'pp.'];

/** Every app key except the ones above. Keys of other libraries are left alone. */
export function keysToErase(all: readonly string[]): string[] {
  return all.filter((k) => APP_PREFIXES.some((p) => k.startsWith(p)) && !KEEP_KEYS.includes(k));
}
