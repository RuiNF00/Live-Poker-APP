import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { grantPending } from '@/lib/referrals';
import { codeToRegister, inviteUrl, json, platformOf, readBody } from '../shared';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST { installId, myCode?, rcUserId?, platform? } → { code, url, invited, activated, daysEarned, proUntil, discounts, offer }
 * for the invite screen. offer: the invite discount usable now ({ until, iosCode }), or null. Also retries this install's pending RevenueCat grants (a referrer
 * earns while the app is closed, so the reward lands the next time they open it).
 */
export async function POST(req: Request) {
  const r = await readBody(req, 'status');
  if (r.error) return r.error;
  const { installId, rcUserId } = r.body;
  try {
    await r.b.codeFor(installId, codeToRegister(r.body), rcUserId);
    await grantPending(r.b, await r.b.pending(installId));
    const s = await r.b.status(installId);
    const platform = platformOf(r.body);
    const offer = s ? await r.b.offer(installId, platform) : null;
    // An open iPhone discount with no code: the pool is empty or the daily cap was hit (Security
    // brake against made-up installs). Logged as an error so it shows in Vercel's alerts.
    if (platform === 'ios' && offer && !offer.iosCode) console.error('[invite] App Store code not handed out: pool empty or daily cap reached');
    return json(s ? { ...s, url: inviteUrl(s.code), offer } : null);
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
