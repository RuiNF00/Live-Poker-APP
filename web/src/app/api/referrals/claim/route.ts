import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { normalizeCode, type ReferralSource } from '@/lib/referrals';
import { codeToRegister, json, readBody } from '../shared';

const SOURCES: ReferralSource[] = ['share', 'story', 'link', 'manual', 'play_referrer'];

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST { installId, code, myCode?, source?, shareId?, rcUserId? } → { result }
 * result: ok | already | unknown_code | self | too_late (claims close 7 days after first app_open).
 */
export async function POST(req: Request) {
  const r = await readBody(req, 'claim');
  if (r.error) return r.error;
  const { installId, rcUserId, raw } = r.body;
  const code = typeof raw.code === 'string' ? normalizeCode(raw.code) : null;
  if (!code) return json({ result: 'unknown_code' });
  const source = SOURCES.includes(raw.source as ReferralSource) ? (raw.source as ReferralSource) : 'link';
  const shareId = typeof raw.shareId === 'string' && /^[A-Za-z0-9]{3,20}$/.test(raw.shareId) ? raw.shareId : null;
  try {
    // The friend gets a code too (to invite others) and we learn their RevenueCat user for the reward.
    await r.b.codeFor(installId, codeToRegister(r.body), rcUserId);
    return json({ result: await r.b.claim(installId, code, source, shareId) });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
