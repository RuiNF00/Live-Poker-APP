import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { clientIp, rateLimited } from '@/lib/ratelimit';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ comments: await getStore().listComments(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (rateLimited(`comment:${clientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: { authorName?: unknown; body?: unknown; stepIndex?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const authorName = typeof body.authorName === 'string' ? body.authorName.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  const stepIndex = Number.isInteger(body.stepIndex) && (body.stepIndex as number) >= 0 && (body.stepIndex as number) <= 500 ? (body.stepIndex as number) : null;
  if (!authorName || authorName.length > 40 || !text || text.length > 1000) {
    return NextResponse.json({ error: 'invalid_comment' }, { status: 422 });
  }
  try {
    const comment = await getStore().addComment(id, { authorName, body: text, stepIndex });
    if (!comment) return NextResponse.json({ error: 'comments_closed' }, { status: 404 });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    if (String((e as Error)?.message).includes('rate_limited')) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    throw e;
  }
}
