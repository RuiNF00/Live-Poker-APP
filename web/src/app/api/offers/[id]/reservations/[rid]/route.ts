import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { offersStore, STATUSES, validId, type ReservationStatus } from '@/lib/offers-store';

type Ctx = { params: Promise<{ id: string; rid: string }> };

const cors2 = { ...cors, 'access-control-allow-methods': 'PATCH, OPTIONS' };
const noStore = { ...cors2, 'cache-control': 'no-store' };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors2 });
}

/**
 * The player confirms or declines: PATCH { status } with `x-edit-token` -> { ok: true }.
 * 404 when gone or the token is wrong; 409 sold_out when a declined reservation no longer fits.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, rid } = await params;
  if (await limited(req, 'offer-status', 600, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const token = req.headers.get('x-edit-token') ?? '';
  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  const status = STATUSES.find((s) => s === body?.status) as ReservationStatus | undefined;
  if (!status) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: noStore });
  if (!token || !validId(id) || !validId(rid)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  const res = await offersStore().setStatus(id, token, rid, status);
  if (res === 'ok') return NextResponse.json({ ok: true }, { headers: noStore });
  const code = res === 'sold_out' ? 409 : res === 'invalid' ? 422 : 404;
  return NextResponse.json({ error: res }, { status: code, headers: noStore });
}
