import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { grantPending } from '@/lib/referrals';
import { codeToRegister, inviteUrl, json, readBody } from '../shared';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST { installId, myCode?, rcUserId? } → { code, url, invited, activated, daysEarned, proUntil }
 * for the invite screen. Also retries this install's pending RevenueCat grants (a referrer
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
    return json(s ? { ...s, url: inviteUrl(s.code) } : null);
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
