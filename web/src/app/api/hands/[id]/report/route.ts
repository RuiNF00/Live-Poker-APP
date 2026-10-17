import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { cors } from '@/lib/cors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** POST { reporterId (uuid), reason? }: reports a shared hand; five reports take it down. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (rateLimited(`report:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { reporterId?: string; reason?: unknown } | null;
  if (!body?.reporterId || !UUID.test(body.reporterId)) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 422, headers: cors });
  }
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null;
  const ok = await getStore().reportHand(id, body.reporterId, reason);
  return NextResponse.json({ reported: ok }, { status: ok ? 200 : 404, headers: cors });
}
