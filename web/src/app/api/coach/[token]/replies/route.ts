import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { coachStore, MAX_COMMENT_BYTES, OWNER_RE, parseComment, TOKEN_RE, tooBig } from '@/lib/coach';
import { coachCors } from '../../cors';

type Ctx = { params: Promise<{ token: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: coachCors });
}

/** The player answers from the app: POST with `x-owner-token` { handId, stepIndex?, name, body } -> 201 { comment }. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  const owner = req.headers.get('x-owner-token') ?? '';
  if (!TOKEN_RE.test(token) || !OWNER_RE.test(owner)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: coachCors });
  if (tooBig(req, MAX_COMMENT_BYTES)) return NextResponse.json({ error: 'too_big' }, { status: 413, headers: coachCors });
  if (await limited(req, 'coach-reply', 120, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: coachCors });
  const c = parseComment(await req.json().catch(() => null), false);
  if (!c) return NextResponse.json({ error: 'invalid_comment' }, { status: 422, headers: coachCors });
  const comment = await coachStore().reply(token, owner, c);
  if (!comment) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: coachCors });
  return NextResponse.json({ comment }, { status: 201, headers: coachCors });
}
