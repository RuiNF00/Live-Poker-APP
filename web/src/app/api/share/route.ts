import { NextResponse } from 'next/server';
import { validateHand, STREETS, type HandRecord } from '@livepoker/hand-format';
import { brand } from '@/config/brand';
import { getStore, type QuizSpot } from '@/lib/store';
import { clientIp, rateLimited } from '@/lib/ratelimit';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

function parseQuiz(hand: HandRecord, quiz: unknown): QuizSpot | null | 'invalid' {
  if (quiz == null) return null;
  const q = quiz as QuizSpot;
  if (!STREETS.includes(q.street) || !Number.isInteger(q.actionIndex)) return 'invalid';
  const action = hand.actions[q.street]?.[q.actionIndex];
  if (!action || action.type.startsWith('post_')) return 'invalid';
  return { street: q.street, actionIndex: q.actionIndex };
}

/**
 * Creates a share link. Called by the mobile app:
 * POST { hand: HandRecord, title?, revealAll?, quiz?: { street, actionIndex }, allowComments? }
 * -> 201 { id, url, editToken }  (keep editToken on the device to delete the share later)
 */
export async function POST(req: Request) {
  if (rateLimited(`share:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: cors });
  }
  const errors = validateHand(body.hand);
  if (errors.length) return NextResponse.json({ error: 'invalid_hand', details: errors }, { status: 422, headers: cors });
  const hand = body.hand as HandRecord;
  const quiz = parseQuiz(hand, body.quiz);
  if (quiz === 'invalid') return NextResponse.json({ error: 'invalid_quiz' }, { status: 422, headers: cors });
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) || null : null;

  const { id, editToken } = await getStore().createShare({
    hand,
    title,
    revealAll: body.revealAll === true,
    quiz,
    allowComments: body.allowComments !== false,
  });
  return NextResponse.json({ id, url: `${brand.siteUrl}/h/${id}`, editToken }, { status: 201, headers: cors });
}
