// How a store purchase ended, kept apart from the SDK so it can be tested.

/** RevenueCat's PAYMENT_PENDING_ERROR: Ask to Buy or a card the store is still checking. */
const PAYMENT_PENDING = '20';

// RevenueCat PURCHASES_ERROR_CODE values that need their own answer.
const NOT_ALLOWED = '3';
const OWNED = ['6', '7', '13'];
const NETWORK = ['10', '35'];
const IN_PROGRESS = '15';

export function buyError(e: unknown): BuyResult {
  const err = e as { userCancelled?: boolean; code?: string } | null;
  if (err?.userCancelled) return 'cancelled';
  const code = err?.code;
  if (code === PAYMENT_PENDING) return 'pending';
  if (code === IN_PROGRESS) return 'busy';
  if (code === NOT_ALLOWED) return 'blocked';
  if (code && OWNED.includes(code)) return 'owned';
  // The store may have charged before the line dropped: never say "nothing was charged" here.
  if (code && NETWORK.includes(code)) return 'network';
  return 'error';
}

/**
 * 'pending': the store took the request but hasn't charged yet; Pro turns on through the listener when it does.
 * 'busy': a second tap while the first purchase is still open (nothing to say).
 * 'network': the line dropped mid-purchase; it may or may not have gone through.
 * 'blocked': purchases are turned off on this phone (Screen Time, parental controls).
 * 'owned': this store account already has it: Restore turns Pro on.
 */
export type BuyResult = 'ok' | 'cancelled' | 'pending' | 'unavailable' | 'busy' | 'network' | 'blocked' | 'owned' | 'error';

/** Google Play reports a product as `subscription:baseplan`; a plan change names only the subscription. */
export const playSubscriptionId = (product: string) => product.split(':')[0];

/** The part of RevenueCat's CustomerInfo a restore reads. */
export interface RestoredInfo {
  entitlements: { active: Record<string, { productIdentifier: string; expirationDate: string | null } | undefined> };
}

/**
 * What a restore found. Pro is the active entitlement, whatever bought it: a subscription, or the
 * one-time Pro, which has no end date and is no subscription ('lifetime', said in its own words).
 */
export function restoreFound(info: RestoredInfo, entitlement: string, lifetimeProduct: string): 'ok' | 'lifetime' | 'none' {
  const e = info.entitlements.active[entitlement];
  if (!e) return 'none';
  return e.productIdentifier === lifetimeProduct || !e.expirationDate ? 'lifetime' : 'ok';
}
