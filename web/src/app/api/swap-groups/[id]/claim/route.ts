import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { groupStore, loadGroup, publicGroup } from '@/lib/swap-groups';
import { groupCors, noStore, validGroupId } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: groupCors });
}

/**
 * A player takes their seat: POST { seat, invite } -> { token, group }. `invite` comes from the
 * group link's fragment. Works once per seat; a taken seat or wrong invite gives 409.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'swap-confirm', 30, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: groupCors });
  const body = (await req.json().catch(() => null)) as { seat?: unknown; invite?: unknown } | null;
  const seat = body?.seat;
  const invite = typeof body?.invite === 'string' && /^[a-f0-9]{32,128}$/.test(body.invite) ? body.invite : '';
  if (typeof seat !== 'number' || !Number.isInteger(seat) || seat < 1 || seat > 7 || !invite) {
    return NextResponse.json({ error: 'invalid_claim' }, { status: 422, headers: groupCors });
  }
  if (!validGroupId(id)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: groupCors });
  const token = await groupStore().claim(id, invite, seat);
  const rec = await loadGroup(id);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  if (!token) return NextResponse.json({ error: 'seat_taken', group: publicGroup(rec, null) }, { status: 409, headers: noStore });
  return NextResponse.json({ token, group: publicGroup(rec, seat) }, { headers: noStore });
}
