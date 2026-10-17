import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { loadOffer, offersStore, parseOffer, validId } from '@/lib/offers-store';
import { clientIp, rateLimited } from '@/lib/ratelimit';

type Ctx = { params: Promise<{ id: string }> };

const cors2 = { ...cors, 'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS' };
const noStore = { ...cors2, 'cache-control': 'no-store' };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors2 });
}

/** { offer, confirmedAt, updatedAt }: the app polls this to see whether the backer confirmed. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (rateLimited(`offer-read:${clientIp(req)}`, 600, 3600 * 1000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const rec = await loadOffer(id);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  return NextResponse.json({ offer: rec.offer, confirmedAt: rec.confirmedAt, updatedAt: rec.updatedAt }, { headers: noStore });
}

/**
 * PUT { offer } with `x-edit-token` -> { updated }. 404 when gone or the token is wrong.
 * New markup or events clear confirmedAt: the backer confirms the new terms.
 */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'offer-update', 300, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const token = req.headers.get('x-edit-token') ?? '';
  const body = (await req.json().catch(() => null)) as { offer?: unknown } | null;
  const offer = parseOffer(body?.offer);
  if (offer === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: noStore });
  if (!offer) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: noStore });
  const ok = !!token && validId(id) && (await offersStore().update(id, token, offer));
  return NextResponse.json({ updated: ok }, { status: ok ? 200 : 404, headers: noStore });
}

/** DELETE with `x-edit-token`: the link is gone for the backer too. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = req.headers.get('x-edit-token') ?? '';
  const ok = !!token && validId(id) && (await offersStore().remove(id, token));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers: noStore });
}
