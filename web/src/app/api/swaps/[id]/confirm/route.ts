import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { loadSwap, ownToken, parseName, publicSwap, swapStore, validId } from '@/lib/swaps';
import { noStore, swapCors } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: swapCors });
}

/**
 * The other player accepts: POST { name, token? } -> { token, swap }. Works once; after that 409.
 * The token (side 'b') is shown once, kept by their browser or app. `token` (64 hex) is the
 * app's own: the same confirm sent again after a lost answer gets in instead of a 409.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'swap-confirm', 30, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: swapCors });
  const body = (await req.json().catch(() => null)) as { name?: unknown; token?: unknown } | null;
  const name = parseName(body?.name);
  if (name === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: swapCors });
  if (!name) return NextResponse.json({ error: 'invalid_name' }, { status: 422, headers: swapCors });
  if (!validId(id)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: swapCors });
  const token = await swapStore().confirm(id, name, ownToken(body?.token));
  const rec = await loadSwap(id);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  if (!token) return NextResponse.json({ error: 'already_confirmed', swap: publicSwap(rec, null) }, { status: 409, headers: noStore });
  return NextResponse.json({ token, swap: publicSwap(rec, 'b') }, { headers: noStore });
}
