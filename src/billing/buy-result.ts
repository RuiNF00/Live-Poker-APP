// How a store purchase ended, kept apart from the SDK so it can be tested.

/** RevenueCat's PAYMENT_PENDING_ERROR: Ask to Buy or a card the store is still checking. */
const PAYMENT_PENDING = '20';

export function buyError(e: unknown): BuyResult {
  const err = e as { userCancelled?: boolean; code?: string } | null;
  if (err?.userCancelled) return 'cancelled';
  return err?.code === PAYMENT_PENDING ? 'pending' : 'error';
}

/** 'pending': the store took the request but hasn't charged yet; Pro turns on through the listener when it does. */
export type BuyResult = 'ok' | 'cancelled' | 'pending' | 'unavailable' | 'error';
