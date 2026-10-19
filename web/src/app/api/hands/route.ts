import { NextResponse } from 'next/server';
import { isOffensive } from '@/lib/moderation';
import { brand } from '@/config/brand';
import { BadCreateToken, CreateGone, createToken, getStore } from '@/lib/store';
import { parseQuiz, resolveHand } from '@/lib/hand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { withoutPrivateGame } from '@/lib/hand-private';

/** Fields of the app's hand that stay on the phone (the app strips them too). */
const PRIVATE_FIELDS = ['streetNotes', 'reviewNote', 'voiceNote', 'folders', 'review', 'reviewedAt', 'shareToken', 'sessionId'] as const;

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Creates a share link. Called by the app (src/lib/share-api.ts uploadHand):
 * POST { hand: Hand, title?, quiz?: { action: n }, revealAll?, allowComments?, token? }
 * -> 201 { id, token, url }. The app keeps `token` to delete the share later. With its own `token`
 * (64 hex), sending the same create again returns the same link: a retry never makes a second one.
 */
export async function POST(req: Request) {
  if (await limited(req, 'share', 60, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: cors });
  const resolved = resolveHand(body.hand);
  if (!resolved) return NextResponse.json({ error: 'invalid_hand' }, { status: 422, headers: cors });
  let token: string | null;
  try {
    token = createToken(body.token);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 422, headers: cors });
  }
  const quiz = parseQuiz(resolved, body.quiz);
  if (quiz === 'invalid') return NextResponse.json({ error: 'invalid_quiz' }, { status: 422, headers: cors });

  const appTitle = (body.hand as { title?: unknown }).title;
  const rawTitle = typeof body.title === 'string' ? body.title : typeof appTitle === 'string' ? appTitle : '';
  // Public text passes the same filter as comments. An offensive title or note is left out rather
  // than failing the share: the hand itself still goes up.
  const title = rawTitle.trim().slice(0, 120);
  const hand = { ...(body.hand as Record<string, unknown>) };
  // The player's private fields never go public, even from an older app that still sends them.
  // `notes` stays: the player can choose to share them.
  for (const key of PRIVATE_FIELDS) delete hand[key];
  if (hand.game && typeof hand.game === 'object') hand.game = withoutPrivateGame(hand).game;
  // The player's own notebook ids for the people at the table stay on the phone.
  if (Array.isArray(hand.players)) hand.players = hand.players.map((p) => (p && typeof p === 'object' ? (({ playerId: _, ...rest }) => rest)(p as Record<string, unknown>) : p));
  if (typeof hand.notes === 'string' && isOffensive(hand.notes)) hand.notes = '';
  if (typeof hand.title === 'string' && isOffensive(hand.title)) hand.title = '';
  // "O que queres saber?": one line at the top of the page, through the same filter.
  const ask = typeof hand.ask === 'string' ? hand.ask.replace(/\s+/g, ' ').trim().slice(0, 140) : '';
  if (ask && !isOffensive(ask)) hand.ask = ask;
  else delete hand.ask;
  let made: { id: string; editToken: string };
  try {
    made = await getStore().createShare({
      payload: hand,
      title: title && !isOffensive(title) ? title : null,
      revealAll: body.revealAll === true,
      quiz,
      allowComments: body.allowComments !== false,
      token,
    });
  } catch (e) {
    // A retry for a hand taken down by reports since: it stays down.
    if (e instanceof CreateGone) return NextResponse.json({ error: 'gone' }, { status: 410, headers: cors });
    if (e instanceof BadCreateToken) return NextResponse.json({ error: 'invalid_token' }, { status: 422, headers: cors });
    throw e;
  }
  const { id, editToken } = made;
  return NextResponse.json({ id, token: editToken, url: `${brand.siteUrl}/h/${id}` }, { status: 201, headers: cors });
}
