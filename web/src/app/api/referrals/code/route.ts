import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { normalizeCode } from '@/lib/referrals';
import { codeToRegister, inviteUrl, json, readBody } from '../shared';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST { installId, myCode? | code?, rcUserId? } → { code, url }. Same code every time for an install.
 * `code` registers the app's own code (10 hex chars, the ?r= on its share links) the first time.
 */
export async function POST(req: Request) {
  const r = await readBody(req, 'code');
  if (r.error) return r.error;
  try {
    const own = typeof r.body.raw.code === 'string' ? normalizeCode(r.body.raw.code) : null;
    const code = await r.b.codeFor(r.body.installId, codeToRegister(r.body, own), r.body.rcUserId);
    return json({ code, url: inviteUrl(code) });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
