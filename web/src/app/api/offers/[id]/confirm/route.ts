import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { offersStore, validId } from '@/lib/offers-store';

type Ctx = { params: Promise<{ id: string }> };

const cors2 = { ...cors, 'access-control-allow-methods': 'POST, OPTIONS' };
const noStore = { ...cors2, 'cache-control': 'no-store' };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors2 });
}

/**
 * The backer confirms the piece agreed with the player: POST { seen } -> { confirmedAt }, where
 * seen is the updatedAt the page showed. 409 when the player changed the terms since (the page
 * shows the new ones first). Idempotent (a second press keeps the first time). 20 per IP per hour.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'offer-confirm', 20, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const body = (await req.json().catch(() => null)) as { seen?: unknown } | null;
  // A page from before this check sends no version: it reloads and shows the terms as they are.
  const seen = typeof body?.seen === 'string' && body.seen.length <= 40 && Number.isFinite(Date.parse(body.seen)) ? body.seen : null;
  const r = validId(id) ? await offersStore().confirm(id, seen) : null;
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  if (r === 'stale') return NextResponse.json({ error: 'terms_changed' }, { status: 409, headers: noStore });
  return NextResponse.json({ confirmedAt: r.confirmedAt }, { headers: noStore });
}
