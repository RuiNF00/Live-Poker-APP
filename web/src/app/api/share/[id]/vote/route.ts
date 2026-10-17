import { NextResponse } from 'next/server';
import { getStore, VOTE_CHOICES, type VoteChoice } from '@/lib/store';
import { clientIp, rateLimited } from '@/lib/ratelimit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ counts: await getStore().voteCounts(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (rateLimited(`vote:${clientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const { voterId, choice } = body as { voterId?: string; choice?: VoteChoice };
  if (!voterId || !UUID.test(voterId) || !choice || !VOTE_CHOICES.includes(choice)) {
    return NextResponse.json({ error: 'invalid_vote' }, { status: 422 });
  }
  const store = getStore();
  await store.vote(id, voterId, choice);
  return NextResponse.json({ counts: await store.voteCounts(id) });
}
