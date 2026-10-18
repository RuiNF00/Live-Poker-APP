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
}

export interface TrialEnd {
  appUserId: string;
  platform: 'ios' | 'android' | 'web';
  props: { result: 'paid' | 'ended'; plan: string };
}

const plan = (product = '') => (product.includes('annual') ? 'annual' : product.includes('monthly') ? 'monthly' : 'other');

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

/**
 * A stable install-shaped id for a RevenueCat user we can't match to an install (it never
 * reached the invite server): the counts stay right even when the funnel join can't be made.
 */
export async function installIdForRc(appUserId: string): Promise<string> {
  const h = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rc:${appUserId}`))).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
