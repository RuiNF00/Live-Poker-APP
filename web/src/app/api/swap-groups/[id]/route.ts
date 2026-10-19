import { NextResponse } from 'next/server';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { rcUserIdOf } from '@/lib/swap-pro';
import { groupStore } from '@/lib/swap-groups';
import { groupCors, groupResponse, noStore, tokenOf, validGroupId } from '../shared';

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: groupCors });
}

/** The group. With header `x-edit-token`, `you` is the caller's seat. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (rateLimited(`swap-read:${clientIp(req)}`, 600, 3600 * 1000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  return groupResponse(id, tokenOf(req));
}

/** DELETE with a seat's token: the creator deletes it for everyone; anyone else leaves it. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = tokenOf(req);
  const ok = !!token && validGroupId(id) && (await groupStore().leave(id, token));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers: groupCors });
}

/**
 * PATCH { rcUserId } with the creator's token: their RevenueCat id changed (a reinstall or a
 * restore), so the new one replaces it. Anyone else's token: 404.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = tokenOf(req);
  const rc = rcUserIdOf(((await req.json().catch(() => null)) as { rcUserId?: unknown } | null)?.rcUserId);
  if (!rc) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: groupCors });
  const ok = !!token && validGroupId(id) && (await groupStore().setOwnerRc(id, token, rc));
  return NextResponse.json({ saved: ok }, { status: ok ? 200 : 404, headers: groupCors });
}
