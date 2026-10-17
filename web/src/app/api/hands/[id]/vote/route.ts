import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { voteFromComment } from '@/lib/hand';
import { getStore, VOTE_CHOICES, type VoteChoice } from '@/lib/store';
import { clientIp, rateLimited } from '@/lib/ratelimit';

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ counts: await counts(id) }, { headers: cors });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (rateLimited(`vote:${clientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  const body = await req.json().catch(() => ({}));
  const { voterId, choice } = body as { voterId?: string; choice?: VoteChoice };
  if (!voterId || !UUID.test(voterId) || !choice || !VOTE_CHOICES.includes(choice)) {
    return NextResponse.json({ error: 'invalid_vote' }, { status: 422, headers: cors });
  }
  await getStore().vote(id, voterId, choice);
  return NextResponse.json({ counts: await counts(id) }, { headers: cors });
}
