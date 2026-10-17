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

/**
 * Public: { offer, taken, count, updatedAt }, never a name or a single reservation.
 * With the player's `x-edit-token` it also carries { reservations } (403 with a wrong one).
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (rateLimited(`offer-read:${clientIp(req)}`, 600, 3600 * 1000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const rec = await loadOffer(id);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  const out = { offer: rec.offer, taken: rec.taken, count: rec.count, updatedAt: rec.updatedAt };
  const token = req.headers.get('x-edit-token');
  if (!token) return NextResponse.json(out, { headers: noStore });
  const reservations = await offersStore().reservations(id, token);
  if (!reservations) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: noStore });
  return NextResponse.json({ ...out, reservations }, { headers: noStore });
}

/** PUT { offer } with `x-edit-token`. 404 when gone or the token is wrong; 409 when an event would offer less than is taken. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'offer-update', 300, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const token = req.headers.get('x-edit-token') ?? '';
  const body = (await req.json().catch(() => null)) as { offer?: unknown } | null;
  const offer = parseOffer(body?.offer);
  if (offer === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: noStore });
  if (!offer) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: noStore });
  const res = token && validId(id) ? await offersStore().update(id, token, offer) : 'not_found';
  if (res === 'conflict') return NextResponse.json({ error: 'conflict' }, { status: 409, headers: noStore });
  return NextResponse.json({ updated: res === 'ok' }, { status: res === 'ok' ? 200 : 404, headers: noStore });
}

/** DELETE with `x-edit-token`: the page and its reservations are gone for everyone. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = req.headers.get('x-edit-token') ?? '';
  const ok = !!token && validId(id) && (await offersStore().remove(id, token));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers: noStore });
}
