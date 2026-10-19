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
 * The backer confirms the piece agreed with the player: POST -> { confirmedAt }.
 * Idempotent (a second press keeps the first time). 20 per IP per hour.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'offer-confirm', 20, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const confirmedAt = validId(id) ? await offersStore().confirm(id) : null;
  if (!confirmedAt) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  return NextResponse.json({ confirmedAt }, { headers: noStore });
}
