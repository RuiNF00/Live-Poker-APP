import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { json, readBody } from '../shared';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST { installId } → { erased: true }. "Delete all my data" in the app: this install's
 * invite code and RevenueCat id, the invite it accepted and the ones it sent.
 */
export async function POST(req: Request) {
  const r = await readBody(req, 'erase');
  if (r.error) return r.error;
  try {
    await r.b.erase(r.body.installId);
    return json({ erased: true });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
