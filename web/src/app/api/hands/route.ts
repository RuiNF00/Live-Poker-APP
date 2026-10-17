import { NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { getStore } from '@/lib/store';
import { parseQuiz, resolveHand } from '@/lib/hand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Creates a share link. Called by the app (src/lib/share-api.ts uploadHand):
 * POST { hand: Hand, title?, quiz?: { action: n }, revealAll?, allowComments? }
 * -> 201 { id, token, url }. The app keeps `token` to delete the share later.
 */
export async function POST(req: Request) {
  if (await limited(req, 'share', 60, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: cors });
  const resolved = resolveHand(body.hand);
  if (!resolved) return NextResponse.json({ error: 'invalid_hand' }, { status: 422, headers: cors });
  const quiz = parseQuiz(resolved, body.quiz);
  if (quiz === 'invalid') return NextResponse.json({ error: 'invalid_quiz' }, { status: 422, headers: cors });

  const appTitle = (body.hand as { title?: unknown }).title;
  const rawTitle = typeof body.title === 'string' ? body.title : typeof appTitle === 'string' ? appTitle : '';
  const { id, editToken } = await getStore().createShare({
    payload: body.hand,
    title: rawTitle.trim().slice(0, 120) || null,
    revealAll: body.revealAll === true,
    quiz,
    allowComments: body.allowComments !== false,
  });
  return NextResponse.json({ id, token: editToken, url: `${brand.siteUrl}/h/${id}` }, { status: 201, headers: cors });
}
