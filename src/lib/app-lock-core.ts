// App lock rules, kept pure so they can be tested without a phone.

export type LockMode = 'device' | 'pin';

/** Saved on the phone only (never in backups: a restored phone mustn't lock without its PIN). */
export interface LockConfig {
  mode: LockMode;
  /** PIN mode: sha256(salt + pin), hex. */
  pinHash?: string;
  salt?: string;
}

/** Back in the app within this long (a quick look at a message): no unlock needed. */
export const GRACE_MS = 30000;
export const PIN_LENGTH = 4;

export function needsUnlock(cfg: LockConfig | null, leftAt: number | null, now: number): boolean {
  if (!cfg) return false;
  return leftAt === null || now - leftAt >= GRACE_MS;
}

/** After 5 wrong PINs, a wait that doubles each time: 30 s, 1 min, 2 min… capped at 15 min. */
export function lockoutMs(fails: number): number {
  if (fails < 5) return 0;
  return Math.min(15 * 60000, 30000 * 2 ** (fails - 5));
}

export const validPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
