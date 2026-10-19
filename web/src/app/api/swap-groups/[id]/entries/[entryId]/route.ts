import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { groupStore } from '@/lib/swap-groups';
import { groupCors, groupResponse, tokenOf, validGroupId } from '../../../shared';

type Ctx = { params: Promise<{ id: string; entryId: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: groupCors });
}

/** Removes one of your own entries -> { group }. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (await limited(req, 'swap-del', 60, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: groupCors });
  const { id, entryId } = await params;
  const token = tokenOf(req);
  const ok = !!token && validGroupId(id) && /^[A-Za-z0-9]{1,40}$/.test(entryId) && (await groupStore().removeEntry(id, token, entryId));
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: groupCors });
  return groupResponse(id, token);
}
