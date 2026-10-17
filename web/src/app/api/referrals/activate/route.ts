import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { grantPending, newCode } from '@/lib/referrals';
import { json, readBody } from '../shared';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST { installId, rcUserId? } → { status }. The app calls it after the friend saves a hand
 * (and may call it again on launch): books both rewards once, then grants anything still
 * pending for this install on RevenueCat. Safe to repeat.
 */
export async function POST(req: Request) {
  const r = await readBody(req, 'activate');
  if (r.error) return r.error;
  const { installId, rcUserId } = r.body;
  try {
    await r.b.codeFor(installId, newCode(), rcUserId);
    const booked = await r.b.activate(installId);
    await grantPending(r.b, [...booked, ...(await r.b.pending(installId))]);
    return json({ status: await r.b.status(installId) });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
