// RevenueCat webhook → our own funnel events. Pure, so it can be tested.
// The app can't see how a trial ends when the player never opens it again, so the
// trial's outcome comes from RevenueCat's server instead.

export interface RcWebhookEvent {
  type?: string;
  period_type?: string;
  is_trial_conversion?: boolean;
  environment?: string;
  store?: string;
  product_id?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  /** CANCELLATION: UNSUBSCRIBE, BILLING_ERROR, CUSTOMER_SUPPORT, PRICE_INCREASE, DEVELOPER_INITIATED, UNKNOWN. */
  cancel_reason?: string;
  /** An App Store offer code redeemed with this purchase (the invite's 50%); never forwarded, only its presence. */
  offer_code?: string | null;
}

export interface TrialEnd {
  appUserId: string;
  platform: 'ios' | 'android' | 'web';
  props: { result: 'paid' | 'ended'; plan: string };
}

const plan = (product = '') =>
  product.includes('annual') ? 'annual' : product.includes('monthly') ? 'monthly' : product.includes('lifetime') ? 'lifetime' : 'other';

/**
 * trial_end when a trial turns into a paid period (RENEWAL with is_trial_conversion) or runs
 * out unpaid (EXPIRATION of a TRIAL period). Everything else, and sandbox purchases, is ignored.
 */
export function trialEndFrom(e: RcWebhookEvent | null | undefined): TrialEnd | null {
  if (!e || e.environment === 'SANDBOX') return null;
  const appUserId = e.app_user_id || e.original_app_user_id;
  if (!appUserId) return null;
  const result = e.type === 'RENEWAL' && e.is_trial_conversion ? 'paid' : e.type === 'EXPIRATION' && e.period_type === 'TRIAL' ? 'ended' : null;
  if (!result) return null;
  const platform = e.store === 'APP_STORE' || e.store === 'MAC_APP_STORE' ? 'ios' : e.store === 'PLAY_STORE' ? 'android' : 'web';
  return { appUserId, platform, props: { result, plan: plan(e.product_id) } };
}

export interface FunnelRow {
  event: 'trial_end' | 'store_purchase' | 'sub_cancel';
  appUserId: string;
  platform: 'ios' | 'android' | 'web';
  props: Record<string, string | boolean>;
}

const CANCEL_REASONS = new Set(['unsubscribe', 'billing_error', 'customer_support', 'price_increase', 'developer_initiated']);

/**
 * Every webhook event the funnel counts, as the store saw it (also purchases finished outside
 * the app: Ask to Buy, an App Store offer code, a card checked later):
 *   trial_end      as above;
 *   store_purchase a first purchase: plan, trial, offer (code = an App Store offer code such as
 *                  the invite's, intro = an introductory or Play offer price, none);
 *   sub_cancel     auto-renew turned off: plan, trial, reason (unsubscribe, billing_error...).
 * Nothing that names a person: no ids beyond the RevenueCat user, never the offer code itself.
 */
export function funnelFrom(e: RcWebhookEvent | null | undefined): FunnelRow | null {
  const ended = trialEndFrom(e);
  if (ended) return { event: 'trial_end', ...ended };
  if (!e || e.environment === 'SANDBOX') return null;
  const appUserId = e.app_user_id || e.original_app_user_id;
  if (!appUserId) return null;
  const platform = e.store === 'APP_STORE' || e.store === 'MAC_APP_STORE' ? 'ios' : e.store === 'PLAY_STORE' ? 'android' : 'web';
  const trial = e.period_type === 'TRIAL';
  if (e.type === 'INITIAL_PURCHASE' || e.type === 'NON_RENEWING_PURCHASE') {
    const offer = e.offer_code ? 'code' : e.period_type === 'INTRO' || e.period_type === 'PROMOTIONAL' ? 'intro' : 'none';
    return { event: 'store_purchase', appUserId, platform, props: { plan: plan(e.product_id), trial, offer } };
  }
  if (e.type === 'CANCELLATION') {
    const reason = (e.cancel_reason ?? '').toLowerCase();
    return { event: 'sub_cancel', appUserId, platform, props: { plan: plan(e.product_id), trial, reason: CANCEL_REASONS.has(reason) ? reason : 'unknown' } };
  }
  return null;
}

/**
 * A stable install-shaped id for a RevenueCat user we can't match to an install (it never
 * reached the invite server): the counts stay right even when the funnel join can't be made.
 */
export async function installIdForRc(appUserId: string): Promise<string> {
  const h = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rc:${appUserId}`))).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
