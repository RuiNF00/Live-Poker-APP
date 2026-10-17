import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { cors } from '@/lib/cors';
import { isOffensive } from '@/lib/moderation';

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return NextResponse.json({ comments: await getStore().listComments(id) }, { headers: cors });
}

/** POST { name, text, stepIndex? } -> 201 { comment } */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (rateLimited(`comment:${clientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { name?: unknown; text?: unknown; stepIndex?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const step = body?.stepIndex;
  const stepIndex = Number.isInteger(step) && (step as number) >= 0 && (step as number) <= 500 ? (step as number) : null;
  if (!name || name.length > 40 || !text || text.length > 1000) {
    return NextResponse.json({ error: 'invalid_comment' }, { status: 422, headers: cors });
  }
  if (isOffensive(name) || isOffensive(text)) {
    return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors });
  }
  try {
    const comment = await getStore().addComment(id, { name, text, stepIndex });
    if (!comment) return NextResponse.json({ error: 'comments_closed' }, { status: 404, headers: cors });
    return NextResponse.json({ comment }, { status: 201, headers: cors });
  } catch (e) {
    if (String((e as Error)?.message).includes('rate_limited')) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
    }
    throw e;
  }
}
