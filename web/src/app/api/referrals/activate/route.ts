import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { grantPending } from '@/lib/referrals';
import { isNewSubscriber, revenueCatConfigured } from '@/lib/revenuecat';
import { codeToRegister, json, readBody } from '../shared';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST { installId, myCode?, rcUserId? } → { status, booked }. booked is false while the
 * friend's RevenueCat user is missing or not new, so the app keeps retrying. The app calls it after the friend saves a hand
 * (and may call it again on launch): books both rewards once, then grants anything still
 * pending for this install on RevenueCat. Safe to repeat.
 */
export async function POST(req: Request) {
  const r = await readBody(req, 'activate');
  if (r.error) return r.error;
  const { installId, rcUserId } = r.body;
  try {
    await r.b.codeFor(installId, codeToRegister(r.body), rcUserId);
    // Rewards are for new players: the friend's RevenueCat user (the one stored first, not
    // whatever this request says) must exist and be first seen this week, or nothing is booked
    // and the referral stays open. Without RevenueCat set up, production books nothing (P1, 19 Oct).
    const rc = await r.b.awaitingRc(installId);
    const ok = !!rc && (revenueCatConfigured() ? await isNewSubscriber(rc) : process.env.NODE_ENV !== 'production');
    const booked = ok ? await r.b.activate(installId) : [];
    await grantPending(r.b, [...booked, ...(await r.b.pending(installId))]);
    // booked: the referral is activated now (this call or an earlier one whose response was
    // lost). False while it waits for the friend's RevenueCat user, so the app retries.
    return json({ status: await r.b.status(installId), booked: await r.b.activated(installId) });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
