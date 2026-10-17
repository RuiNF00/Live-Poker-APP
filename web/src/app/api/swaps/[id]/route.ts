import { NextResponse } from 'next/server';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { rcUserIdOf } from '@/lib/swap-pro';
import { swapStore, validId } from '@/lib/swaps';
import { noStore, swapCors, swapResponse, tokenOf } from '../shared';

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: swapCors });
}

/** The swap. With header `x-edit-token`, `you` says which side the caller is. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (rateLimited(`swap-read:${clientIp(req)}`, 600, 3600 * 1000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  return swapResponse(id, tokenOf(req));
}

/**
 * DELETE with either side's token: gone for both (each phone keeps its own copy).
 * `?leave=1` ("Delete all my data"): only this side goes; the other keeps a read-only record.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = tokenOf(req);
  const leave = new URL(req.url).searchParams.get('leave') === '1';
  const ok = !!token && validId(id) && (await (leave ? swapStore().leave(id, token) : swapStore().remove(id, token)));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers: swapCors });
}

/**
 * PATCH { rcUserId } with the creator's token: their RevenueCat id changed (a reinstall or a
 * restore), so the new one replaces it. Anyone else's token: 404.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = tokenOf(req);
  const rc = rcUserIdOf(((await req.json().catch(() => null)) as { rcUserId?: unknown } | null)?.rcUserId);
  if (!rc) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: swapCors });
  const ok = !!token && validId(id) && (await swapStore().setOwnerRc(id, token, rc));
  return NextResponse.json({ saved: ok }, { status: ok ? 200 : 404, headers: swapCors });
}
