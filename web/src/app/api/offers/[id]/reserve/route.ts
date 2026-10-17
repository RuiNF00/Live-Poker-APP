import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { loadOffer, offersStore, parseReservation, type ReserveError } from '@/lib/offers-store';

type Ctx = { params: Promise<{ id: string }> };

const cors2 = { ...cors, 'access-control-allow-methods': 'POST, OPTIONS' };
const noStore = { ...cors2, 'cache-control': 'no-store' };

const STATUS: Record<ReserveError, number> = { not_found: 404, closed: 409, sold_out: 409, full: 409, over_cap: 422, invalid: 422 };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors2 });
}

/**
 * A backer reserves: POST { reservation: { name, contact?, shares: [{ e, p }] } } -> 201 { rid }.
 * Cap and what is left are checked again by the store under a lock (row lock in SQL),
 * so the answer holds even when two backers press at once.
 * 409 closed / sold_out / full, 422 invalid / over_cap / offensive, 429 over 10 an hour.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'offer-reserve', 10, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const rec = await loadOffer(id);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  if (rec.offer.closed) return NextResponse.json({ error: 'closed' }, { status: 409, headers: noStore });
  const body = (await req.json().catch(() => null)) as { reservation?: unknown } | null;
  const r = parseReservation(body?.reservation, rec.offer);
  if (r === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: noStore });
  if (!r) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: noStore });
  const res = await offersStore().reserve(id, r);
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: STATUS[res.error], headers: noStore });
  return NextResponse.json({ rid: res.rid }, { status: 201, headers: noStore });
}
