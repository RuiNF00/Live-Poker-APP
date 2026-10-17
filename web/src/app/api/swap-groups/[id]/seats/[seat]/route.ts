import { NextResponse } from 'next/server';
import { groupStore } from '@/lib/swap-groups';
import { groupCors, groupResponse, tokenOf, validGroupId } from '../../../shared';

type Ctx = { params: Promise<{ id: string; seat: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: groupCors });
}

/**
 * The creator (seat 0's token) takes a player out: DELETE -> { group }. A player who joined: the
 * seat is open again for anyone with the group link, refused (409) once that seat has anything in
 * the accounts. A player who never joined: the seat goes (from 4 players up; 409 at 3).
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id, seat: s } = await params;
  const token = tokenOf(req);
  const seat = /^[1-7]$/.test(s) ? Number(s) : 0;
  if (!token || !seat || !validGroupId(id)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: groupCors });
  const store = groupStore();
  const ok = (await store.release(id, token, seat)) || (await store.removeSeat(id, token, seat));
  if (!ok) return NextResponse.json({ error: 'seat_in_use' }, { status: 409, headers: groupCors });
  return groupResponse(id, token);
}
