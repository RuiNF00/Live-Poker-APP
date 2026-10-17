import 'server-only';

/**
 * Grants the Pro entitlement until `endMs` as a RevenueCat promotional entitlement
 * (REST v1, secret key). Returns false when RevenueCat isn't configured or refused.
 */
export async function grantPromotional(appUserId: string, endMs: number): Promise<boolean> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return false;
  const entitlement = process.env.REVENUECAT_ENTITLEMENT || 'pro';
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(entitlement)}/promotional`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ end_time_ms: endMs }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
