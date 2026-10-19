import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * DELETE with header `x-edit-token` (the hand's own token): the player who shared the hand removes
 * a comment. `?block=1` also blocks its author on that hand: their other comments hide and new
 * ones are refused (App Store 1.2 / Play UGC). 404 for a wrong token or comment, so ids can't be probed.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { commentId } = await params;
  if (await limited(req, 'comment-remove', 60, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const token = req.headers.get('x-edit-token') ?? '';
  if (!UUID.test(commentId) || !token || token.length > 200) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: cors });
  const block = new URL(req.url).searchParams.get('block') === '1';
  const ok = await getStore().removeComment(commentId, token, block);
  return ok ? NextResponse.json({ removed: true, blocked: block }, { headers: cors }) : NextResponse.json({ error: 'not_found' }, { status: 404, headers: cors });
}
