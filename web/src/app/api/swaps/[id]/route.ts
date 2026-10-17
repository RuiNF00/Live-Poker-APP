import { NextResponse } from 'next/server';
import { clientIp, rateLimited } from '@/lib/ratelimit';
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

/** DELETE with either side's token: gone for both (each phone keeps its own copy). */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = tokenOf(req);
  const ok = !!token && validId(id) && (await swapStore().remove(id, token));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers: swapCors });
}
