import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { parseEntry, swapStore, validId } from '@/lib/swaps';
import { swapCors, swapResponse, tokenOf } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: swapCors });
}

/**
 * Adds a prize you won or a payment you made, for your side only (from `x-edit-token`):
 * POST { entry: { cid, kind, amount, event?, finish? } } -> { swap }. Same cid twice adds it once.
 * 409 before the other player confirms.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'swap-entry', 300, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: swapCors });
  const token = tokenOf(req);
  const body = (await req.json().catch(() => null)) as { entry?: unknown } | null;
  const entry = parseEntry(body?.entry);
  if (entry === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: swapCors });
  if (!entry) return NextResponse.json({ error: 'invalid_entry' }, { status: 422, headers: swapCors });
  if (!token || !validId(id)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: swapCors });
  const store = swapStore();
  const side = await store.side(id, token);
  if (!side) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: swapCors });
  const ok = await store.addEntry(id, token, entry);
  if (ok === false) return NextResponse.json({ error: 'not_confirmed' }, { status: 409, headers: swapCors });
  // The other player already recorded this money: refused, with what is still owed and the swap as it is.
  if (typeof ok === 'number') return swapResponse(id, token, 422, { error: 'overpaid', left: ok });
  return swapResponse(id, token);
}
