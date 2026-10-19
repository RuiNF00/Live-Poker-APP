import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { liveStore, loadLive, parseSnapshot, validId } from '@/lib/live';
import { clientIp, rateLimited } from '@/lib/ratelimit';

type Ctx = { params: Promise<{ id: string }> };

const cors2 = { ...cors, 'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS' };
const noStore = { ...cors2, 'cache-control': 'no-store' };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors2 });
}

/** The latest snapshot, polled by the live page (every 20 s per open tab). */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  // Polls are frequent and cheap: only the per-instance limiter, no database write per poll.
  if (rateLimited(`live-read:${clientIp(req)}`, 1200, 3600 * 1000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const rec = await loadLive(id);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  return NextResponse.json({ snapshot: rec.snapshot, updatedAt: rec.updatedAt }, { headers: noStore });
}

/** PUT { snapshot } with header `x-edit-token`. 404 when the link is gone or the token is wrong. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'live-update', 600, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors2 });
  const token = req.headers.get('x-edit-token') ?? '';
  const body = (await req.json().catch(() => null)) as { snapshot?: unknown } | null;
  const snap = parseSnapshot(body?.snapshot);
  if (snap === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors2 });
  if (!snap) return NextResponse.json({ error: 'invalid_snapshot' }, { status: 422, headers: cors2 });
  const ok = !!token && validId(id) && (await liveStore().update(id, token, snap));
  return NextResponse.json({ updated: ok }, { status: ok ? 200 : 404, headers: cors2 });
}

/** DELETE with header `x-edit-token`: the page is gone for everyone. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = req.headers.get('x-edit-token') ?? '';
  const ok = !!token && validId(id) && (await liveStore().remove(id, token));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers: cors2 });
}
