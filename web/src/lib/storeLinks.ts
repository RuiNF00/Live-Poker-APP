import { brand } from '@/config/brand';

export type Utm = Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content', string>>;

/**
 * Store links with attribution each store actually reads:
 * Google Play takes the utm_* inside `referrer`; the App Store takes a campaign token `ct`
 * (plus `pt`, the provider token from App Store Connect, when set) and `mt=8`.
 */
export function storeLinks(utm: Utm, ref?: string | null): { ios: string; android: string } {
  return { ios: appStoreUrl(utm), android: playStoreUrl(utm, ref) };
}

/** `ref` (an invite code) rides in the Play referrer so Android claims it without the friend typing it. */
function playStoreUrl(utm: Utm, ref?: string | null): string {
  if (!brand.playStoreUrl) return '';
  const u = new URL(brand.playStoreUrl);
  const referrer = new URLSearchParams(Object.entries(utm).filter(([, v]) => !!v) as [string, string][]);
  if (ref) referrer.set('ref', ref);
  if ([...referrer].length) u.searchParams.set('referrer', referrer.toString());
  return u.toString();
}

function appStoreUrl(utm: Utm): string {
  if (!brand.appStoreUrl) return '';
  const u = new URL(brand.appStoreUrl);
  const ct = [utm.utm_source, utm.utm_campaign].filter(Boolean).join('-').slice(0, 40);
  if (ct) u.searchParams.set('ct', ct);
  if (brand.appStoreProviderToken) u.searchParams.set('pt', brand.appStoreProviderToken);
  u.searchParams.set('mt', '8');
  return u.toString();
}
