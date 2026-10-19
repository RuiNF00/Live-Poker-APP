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

interface Subscriber {
  first_seen?: string;
  entitlements?: Record<string, { expires_date?: string | null }>;
}

/** The RevenueCat subscriber (REST v1), or null when unknown, unconfigured or unreachable. */
async function getSubscriber(appUserId: string): Promise<Subscriber | null> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return ((await res.json()) as { subscriber?: Subscriber }).subscriber ?? null;
  } catch {
    return null;
  }
}

export const revenueCatConfigured = () => !!process.env.REVENUECAT_SECRET_KEY;

/**
 * Referral rewards go to new players only: the RevenueCat user must have been first seen in
 * the last `days` days, so an old id earns nothing. The v1 lookup creates a customer it doesn't
 * know (first_seen = now), so a user first seen in the last minute is refused too: a made-up id
 * would otherwise pass as brand new (Security, 19 Oct). The app retries on its next launch.
 */
export async function isNewSubscriber(appUserId: string, days = 7, now = Date.now()): Promise<boolean> {
  const first = Date.parse((await getSubscriber(appUserId))?.first_seen ?? '');
  return Number.isFinite(first) && now - first >= 60_000 && now - first < days * 86_400_000;
}

const proCache = new Map<string, { pro: boolean; at: number }>();

/** Whether the user has the Pro entitlement now (paid, trial or promotional). Cached 5 minutes (30 s for a no). */
export async function hasPro(appUserId: string): Promise<boolean> {
  const hit = proCache.get(appUserId);
  // A "no" is cached briefly so a fresh purchase shows up quickly.
  if (hit && Date.now() - hit.at < (hit.pro ? 5 * 60_000 : 30_000)) return hit.pro;
  const ent = (await getSubscriber(appUserId))?.entitlements?.[process.env.REVENUECAT_ENTITLEMENT || 'pro'];
  const pro = !!ent && (ent.expires_date == null || Date.parse(ent.expires_date) > Date.now());
  if (proCache.size > 5000) proCache.clear();
  proCache.set(appUserId, { pro, at: Date.now() });
  return pro;
}
