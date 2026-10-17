import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { isOffensive } from '@/lib/moderation';
import { stepsOf, streetOfStep, streetStep } from '@/lib/hand';
import type { Street } from '@livepoker/hand-format';

const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const store = getStore();
  const [comments, share] = await Promise.all([store.listComments(id), store.getShare(id)]);
  const steps = share ? stepsOf(share.payload) : null;
  return NextResponse.json({ comments: comments.map((c) => ({ ...c, street: steps ? streetOfStep(steps, c.stepIndex) : null })) }, { headers: cors });
}

/** POST { name, text, stepIndex? | street? } -> 201 { comment }. The app sends a street: its replay steps aren't the page's. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'comment', 30, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { name?: unknown; text?: unknown; stepIndex?: unknown; street?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const step = body?.stepIndex;
  let stepIndex = Number.isInteger(step) && (step as number) >= 0 && (step as number) <= 500 ? (step as number) : null;
  const street = STREETS.includes(body?.street as Street) ? (body!.street as Street) : null;
  if (!name || name.length > 40 || !text || text.length > 1000) {
    return NextResponse.json({ error: 'invalid_comment' }, { status: 422, headers: cors });
  }
  if (isOffensive(name) || isOffensive(text)) {
    return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors });
  }
  let steps: ReturnType<typeof stepsOf> = null;
  if (street || stepIndex !== null) {
    const share = await getStore().getShare(id);
    steps = share ? stepsOf(share.payload) : null;
    if (street && stepIndex === null) stepIndex = steps ? streetStep(steps, street) : null;
  }
  try {
    const comment = await getStore().addComment(id, { name, text, stepIndex });
    if (!comment) return NextResponse.json({ error: 'comments_closed' }, { status: 404, headers: cors });
    return NextResponse.json({ comment: { ...comment, street: steps ? streetOfStep(steps, comment.stepIndex) : null } }, { status: 201, headers: cors });
  } catch (e) {
    if (String((e as Error)?.message).includes('rate_limited')) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
    }
    throw e;
  }
}
