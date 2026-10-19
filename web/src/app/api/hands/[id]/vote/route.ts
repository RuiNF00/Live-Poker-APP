import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { resolveHand, voteFromComment } from '@/lib/hand';
import { getStore, loadShare, VOTE_CHOICES, type VoteChoice } from '@/lib/store';
import { ipHash, limited, voterUuid } from '@/lib/abuse';

/** Votes from the web plus the app's "🗳️ <choice>" comments. */
async function counts(id: string) {
  const store = getStore();
  const [votes, comments] = await Promise.all([store.voteCounts(id), store.listComments(id)]);
  for (const c of comments) {
    const v = voteFromComment(c.text);
    if (v) votes[v] = (votes[v] ?? 0) + 1;
  }
  return votes;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The whole hand, as the vote sends it back. */
async function fullHand(id: string) {
  const share = await loadShare(id);
  return share ? (resolveHand(share.payload)?.hand ?? null) : null;
}

/** GET -> { counts }. With ?reveal=1 -> { hand }: a friend who skipped the challenge (or whose vote didn't go through) still sees the real play. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (new URL(req.url).searchParams.get('reveal') === '1') {
    if (await limited(req, 'reveal', 300, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
    const hand = await fullHand(id);
    if (!hand) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: cors });
    return NextResponse.json({ hand }, { headers: cors });
  }
  return NextResponse.json({ counts: await counts(id) }, { headers: cors });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (await limited(req, 'vote', 120, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  const body = await req.json().catch(() => ({}));
  const { voterId, choice } = body as { voterId?: string; choice?: VoteChoice };
  if (!voterId || !UUID.test(voterId) || !choice || !VOTE_CHOICES.includes(choice)) {
    return NextResponse.json({ error: 'invalid_vote' }, { status: 422, headers: cors });
  }
  // The browser's id is only a key for re-votes: the server derives the stored id, and SQL
  // caps voters per IP per hand.
  await getStore().vote(id, voterUuid(voterId), choice, ipHash(req));
  // The challenge page only had the hand up to the decision: the vote unlocks the rest.
  return NextResponse.json({ counts: await counts(id), hand: await fullHand(id) }, { headers: cors });
}
