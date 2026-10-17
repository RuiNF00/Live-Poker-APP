// The invite reward's state on the phone, kept apart from the network and React
// Native so it can be tested: a friend who came through an invite and saved a
// first hand books 50% off the first month of Pro for both players. Either can happen first,
// and either can happen offline.

export interface ClaimState {
  code: string;
  result: 'ok' | 'already';
  activated?: boolean;
  handSaved?: boolean;
}

interface KV {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}

/** POST /api/referrals/activate. Throws when offline; null when invites are off on the server. */
export type ActivatePost = () => Promise<{ booked?: boolean } | null>;

/** granted: the discount is booked for both. not_yet: worth trying again (offline, or RevenueCat hasn't seen us). none: nothing to do. */
export type Activation = 'granted' | 'not_yet' | 'none';

export const CLAIM_KEY = 'rl.claim.v1';
/** A hand was saved on this install (set even before any invite is known). */
export const HAND_KEY = 'rl.firsthand.v1';

export function createInviteReward(kv: KV, postActivate: ActivatePost) {
  const get = async <T>(k: string): Promise<T | null> => {
    try {
      const v = await kv.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  };
  const set = (k: string, v: unknown) => kv.setItem(k, JSON.stringify(v)).catch(() => {});

  async function activate(): Promise<Activation> {
    const c = await get<ClaimState>(CLAIM_KEY);
    if (!c || c.result !== 'ok' || c.activated) return 'none';
    if (!c.handSaved) {
      if (!(await get<boolean>(HAND_KEY))) return 'none';
      await set(CLAIM_KEY, { ...c, handSaved: true });
    }
    try {
      const r = await postActivate();
      if (!r) return 'none'; // invites switched off
      if (!r.booked) return 'not_yet';
      await set(CLAIM_KEY, { ...c, handSaved: true, activated: true });
      return 'granted';
    } catch {
      return 'not_yet';
    }
  }

  return {
    claimState: () => get<ClaimState>(CLAIM_KEY),

    /** The server accepted our claim. A hand saved while the claim waited for signal counts now. */
    async claimAccepted(code: string, result: ClaimState['result']): Promise<Activation> {
      const hand = !!(await get<boolean>(HAND_KEY));
      await set(CLAIM_KEY, { code, result, ...(hand ? { handSaved: true } : {}) });
      return result === 'ok' && hand ? activate() : 'none';
    },

    /** A hand was saved: remember it, and turn the reward on if an invite is already claimed. */
    async handSaved(): Promise<Activation> {
      if (!(await get<boolean>(HAND_KEY))) await set(HAND_KEY, true);
      return activate();
    },

    activate,

    /** Claimed, hand saved, reward not booked yet. */
    async pending(): Promise<boolean> {
      const c = await get<ClaimState>(CLAIM_KEY);
      return !!c && c.result === 'ok' && !c.activated && (!!c.handSaved || !!(await get<boolean>(HAND_KEY)));
    },
  };
}
