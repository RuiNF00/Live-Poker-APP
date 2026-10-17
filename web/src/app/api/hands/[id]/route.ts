import { NextResponse } from 'next/server';
import { loadShare, getStore } from '@/lib/store';
import { cors } from '@/lib/cors';

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** The hand exactly as uploaded (the app's fetchHand reads `hand`), and its page views for the sharer. Reading doesn't count as a view. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const share = await loadShare(id);
  if (!share) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: cors });
  return NextResponse.json(
    { id: share.id, hand: share.payload, title: share.title, quiz: share.quiz, createdAt: share.createdAt, views: share.viewCount, from: share.from },
    { headers: cors },
  );
}

/** DELETE with header `x-edit-token` (the `token` returned when the share was created). */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = req.headers.get('x-edit-token') ?? '';
  const ok = token ? await getStore().deleteShare(id, token) : false;
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 403, headers: cors });
}
