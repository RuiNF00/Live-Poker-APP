import { NextResponse } from 'next/server';
import { coachStore, OWNER_RE, TOKEN_RE } from '@/lib/coach';
import { coachCors } from '../cors';

type Ctx = { params: Promise<{ token: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: coachCors });
}

/**
 * DELETE with `x-owner-token`: revokes the link. The coach loses access at once; the comments stay
 * readable to the player. With `?erase=1` ("delete all my data") the link is deleted with everything in it.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const { token } = await params;
  const owner = req.headers.get('x-owner-token') ?? '';
  const erase = new URL(req.url).searchParams.get('erase') === '1';
  const store = coachStore();
  const ok = TOKEN_RE.test(token) && OWNER_RE.test(owner) && (await (erase ? store.remove(token, owner) : store.revoke(token, owner)));
  return NextResponse.json(erase ? { deleted: ok } : { revoked: ok }, { status: ok ? 200 : 404, headers: coachCors });
}
