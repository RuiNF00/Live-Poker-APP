// App lock rules, kept pure so they can be tested without a phone.

export type LockMode = 'device' | 'pin';

/** Saved on the phone only (never in backups: a restored phone mustn't lock without its PIN). */
export interface LockConfig {
  mode: LockMode;
  /** PIN mode: sha256(salt + pin), hex. */
  pinHash?: string;
  salt?: string;
  /** The saved lock couldn't be read (a keychain error, a damaged value): asks the phone's own lock, nothing is deleted. */
  unknown?: true;
}

/** What a lock that can't be read becomes: locked, opened with the phone's own Face ID, fingerprint or code. */
export const UNKNOWN_LOCK: LockConfig = { mode: 'device', unknown: true };

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
export const USED_INSTALL_KEYS = ['rl.hands.v2', 'rl.sessions.v2', 'rl.players.v2', 'rl.hands.v1', 'rl.sessions.v1', 'rl.players.v1', 'rl.onboarding.v1'];

/**
 * The first-run questions answered or skipped: their answers are saved only then, by the player's
 * own taps, never at launch (the launch writes '{}' at most). So a lock turned on before any hand,
 * session or player is still known as this install's, and a fresh install never looks used.
 */
const answeredOnboarding = (v: string | null) => {
  try {
    return Array.isArray((JSON.parse(v ?? 'null') as { goals?: unknown } | null)?.goals);
  } catch {
    return false;
  }
};

/** Whether a lock in the keychain belongs to this install: the marker, or this install's own data from a build before it. */
export function lockIsThisInstalls(marker: string | null, used: readonly (readonly [string, string | null])[]): boolean {
  return !!marker || used.some(([k, v]) => (k === 'rl.onboarding.v1' ? answeredOnboarding(v) : v != null));
}

export interface LockIO {
  /** The saved lock from the keychain, or null when there is none. */
  read: () => Promise<string | null>;
  /** The INSTALLED marker, then each of USED_INSTALL_KEYS, from the app's own storage. */
  installKeys: () => Promise<readonly (readonly [string, string | null])[]>;
  markInstalled: () => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * The lock this install has. Fails closed: when the keychain or the app's storage can't be
 * read, or the saved value is damaged, the app stays locked (UNKNOWN_LOCK) rather than open.
 * Only a lock that is plainly a deleted install's leftover is removed.
 */
export async function readLock(io: LockIO): Promise<LockConfig | null> {
  let raw: string | null;
  let keys: readonly (readonly [string, string | null])[];
  try {
    raw = await io.read();
  } catch {
    // The keychain can't be read. Only a phone where the lock was turned on (the marker, kept in
    // the app's own storage) stays locked; everyone else isn't asked for Face ID at every launch.
    try {
      const [[, marker] = ['', null]] = await io.installKeys();
      return marker ? UNKNOWN_LOCK : null;
    } catch {
      return UNKNOWN_LOCK;
    }
  }
  if (!raw) return null;
  try {
    keys = await io.installKeys();
  } catch {
    return UNKNOWN_LOCK;
  }
  const [[, marker] = ['', null], ...used] = keys;
  if (!lockIsThisInstalls(marker, used)) {
    await io.clear().catch(() => {});
    return null;
  }
  // Set by a build from before the marker: mark it now, so it's kept from here on.
  if (!marker) await io.markInstalled().catch(() => {});
  try {
    const cfg = JSON.parse(raw) as LockConfig;
    if (cfg && cfg.mode === 'device') return { mode: 'device' };
    if (cfg && cfg.mode === 'pin' && typeof cfg.salt === 'string' && typeof cfg.pinHash === 'string') return { mode: 'pin', salt: cfg.salt, pinHash: cfg.pinHash };
  } catch {}
  return UNKNOWN_LOCK;
}
