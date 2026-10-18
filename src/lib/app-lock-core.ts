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

/**
 * Keys only an install that has been used holds. Builds before the INSTALLED marker
 * (app-lock.ts) saved a lock without it: a lock found next to any of these is this
 * install's own, from such a build, not one the keychain kept from a deleted install.
 */
export const USED_INSTALL_KEYS = ['rl.hands.v2', 'rl.sessions.v2', 'rl.players.v2', 'rl.hands.v1', 'rl.sessions.v1', 'rl.players.v1'];

/** Whether a lock in the keychain belongs to this install: the marker, or this install's own data from a build before it. */
export function lockIsThisInstalls(marker: string | null, used: readonly (readonly [string, string | null])[]): boolean {
  return !!marker || used.some(([, v]) => v != null);
}
