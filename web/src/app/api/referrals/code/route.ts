import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { newCode } from '@/lib/referrals';
import { inviteUrl, json, readBody } from '../shared';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** POST { installId, rcUserId? } → { code, url }. Same code every time for an install. */
export async function POST(req: Request) {
  const r = await readBody(req, 'code');
  if (r.error) return r.error;
  try {
    const code = await r.b.codeFor(r.body.installId, newCode(), r.body.rcUserId);
    return json({ code, url: inviteUrl(code) });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
