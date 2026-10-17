import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { coachStore, MAX_COMMENT_BYTES, OWNER_RE, parseComment, TOKEN_RE, tooBig } from '@/lib/coach';
import { coachCors } from '../../cors';

type Ctx = { params: Promise<{ token: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: coachCors });
}

/**
 * The player's app reads the comments: GET with `x-owner-token`, `?since=<ISO time>` for only the
 * new ones -> { comments }. Works after the link is revoked, so nothing the coach wrote is lost.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  const owner = req.headers.get('x-owner-token') ?? '';
  if (!TOKEN_RE.test(token) || !OWNER_RE.test(owner)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: coachCors });
  if (await limited(req, 'coach-sync', 600, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: coachCors });
  const since = new URL(req.url).searchParams.get('since');
  const ok = since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : null;
  return NextResponse.json({ comments: await coachStore().since(token, owner, ok) }, { headers: coachCors });
}

/** The coach comments: POST { handId, stepIndex?, mark?, name, body } -> 201 { comment }. 404 once the link is closed. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: coachCors });
  if (tooBig(req, MAX_COMMENT_BYTES)) return NextResponse.json({ error: 'too_big' }, { status: 413, headers: coachCors });
  if (await limited(req, 'coach-comment', 120, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: coachCors });
  const c = parseComment(await req.json().catch(() => null));
  if (!c) return NextResponse.json({ error: 'invalid_comment' }, { status: 422, headers: coachCors });
  const comment = await coachStore().comment(token, c);
  if (!comment) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: coachCors });
  return NextResponse.json({ comment }, { status: 201, headers: coachCors });
}
