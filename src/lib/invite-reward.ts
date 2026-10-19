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
/** The last invite discount the server reported (InviteOffer). */
export const OFFER_KEY = 'rl.ref.offer.v1';

/** The invite discount usable now: until when, and the App Store code on iPhone. */
export interface InviteOffer {
  until: string;
  iosCode: string | null;
}

export interface InviteStatus {
  code: string;
  url: string;
  invited: number;
  activated: number;
  discounts: number;
  offer: InviteOffer | null;
}

const count = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0);

/**
 * The /status answer, checked: without a code and an https link there is nothing to show, so
 * the screen gets null and offers «Tentar outra vez» instead of crashing on s.url (Registo, 19 Oct).
 */
export function inviteStatusFrom(x: unknown): InviteStatus | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.code !== 'string' || !o.code || typeof o.url !== 'string' || !o.url.startsWith('https://')) return null;
  const f = o.offer as Record<string, unknown> | null | undefined;
  const offer = f && typeof f === 'object' && typeof f.until === 'string' ? { until: f.until, iosCode: typeof f.iosCode === 'string' ? f.iosCode : null } : null;
  return { code: o.code, url: o.url, invited: count(o.invited), activated: count(o.activated), discounts: count(o.discounts), offer };
}

/** The offer while it can still be used, else null. */
export const openOffer = (o: InviteOffer | null | undefined, now = Date.now()) => (o && Date.parse(o.until) > now ? o : null);
/** Invite news found at the table or behind the app lock, kept until the player can read it. */
export const NEWS_KEY = 'rl.ref.news.v1';
export type InviteSide = 'friend' | 'inviter';
export interface InviteNews {
  offer: InviteOffer;
  side: InviteSide;
}

/** Nothing opens by itself during a live session, nor over the app lock: the news waits for both to be gone. */
export const canAnnounce = (o: { atTable: boolean; lockUp: boolean }) => !o.atTable && !o.lockUp;

/** The invite news kept for later: one at a time (the newest), taken once, dropped when the discount ran out. */
export function inviteNewsBox(kv: KV) {
  return {
    hold: (n: InviteNews) => kv.setItem(NEWS_KEY, JSON.stringify(n)).catch(() => {}),
    async take(now = Date.now()): Promise<InviteNews | null> {
      let n: InviteNews | null = null;
      try {
        const v = await kv.getItem(NEWS_KEY);
        n = v ? (JSON.parse(v) as InviteNews) : null;
      } catch {
        return null;
      }
      if (!n) return null;
      await kv.setItem(NEWS_KEY, '').catch(() => {});
      return openOffer(n.offer, now) ? n : null;
    },
  };
}

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
