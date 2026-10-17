import { NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { packStore, parsePackHands } from '@/lib/packs';

const headers = { ...cors, 'access-control-allow-headers': 'content-type, x-owner-token' };

export function OPTIONS() {
  return new NextResponse(null, { headers });
}

/**
 * Creates a hand pack. Called by the app: POST { title?, hideAmounts?, hands: [{ id, token }] } with
 * each hand's share id and edit token -> 201 { id, ownerToken, url }. 403 when a hand isn't the caller's.
 */
export async function POST(req: Request) {
  if (Number(req.headers.get('content-length') ?? 0) > 16_000) return NextResponse.json({ error: 'too_big' }, { status: 413, headers });
  if (await limited(req, 'pack-create', 20, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers });
  const body = (await req.json().catch(() => null)) as { title?: unknown; hideAmounts?: unknown; hands?: unknown } | null;
  const hands = parsePackHands(body?.hands);
  if (!hands.length) return NextResponse.json({ error: 'no_hands' }, { status: 422, headers });
  const title = typeof body?.title === 'string' ? body.title.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) : '';
  const made = await packStore().create(title, hands, body?.hideAmounts !== false);
  if (!made) return NextResponse.json({ error: 'not_owner' }, { status: 403, headers });
  return NextResponse.json({ ...made, url: `${brand.siteUrl}/p/${made.id}` }, { status: 201, headers });
}
