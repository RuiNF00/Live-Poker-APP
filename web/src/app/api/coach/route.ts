import { after, NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { coachStore, expiryFrom, HAND_ID_RE, MAX_CREATE_BYTES, MAX_HANDS, stripPrivate, tooBig } from '@/lib/coach';
import { resolveHand } from '@/lib/hand';
import { coachCors } from './cors';

export function OPTIONS() {
  return new NextResponse(null, { headers: coachCors });
}

/**
 * Creates a private coaching link. Called by the app (src/lib/coach-api.ts):
 * POST { title?, player?, expiresInDays?, hands: [{ id, hand }] } -> 201 { token, ownerToken, url }.
 * The app keeps `ownerToken` to read the comments, reply and revoke.
 */
export async function POST(req: Request) {
  if (await limited(req, 'coach-create', 20, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: coachCors });
  }
  if (tooBig(req, MAX_CREATE_BYTES)) return NextResponse.json({ error: 'too_big' }, { status: 413, headers: coachCors });
  const body = (await req.json().catch(() => null)) as { title?: unknown; player?: unknown; expiresInDays?: unknown; hands?: unknown } | null;
  const raw = Array.isArray(body?.hands) ? body.hands : [];
  const seen = new Set<string>();
  const hands: { id: string; payload: unknown }[] = [];
  for (const h of raw.slice(0, MAX_HANDS)) {
    const { id, hand: raw } = (h ?? {}) as { id?: unknown; hand?: unknown };
    const hand = stripPrivate(raw);
    if (typeof id !== 'string' || !HAND_ID_RE.test(id) || seen.has(id) || !resolveHand(hand)) continue;
    seen.add(id);
    hands.push({ id, payload: hand });
  }
  if (!hands.length) return NextResponse.json({ error: 'no_hands' }, { status: 422, headers: coachCors });
  const text = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const store = coachStore();
  const { token, ownerToken } = await store.create(text(body?.title, 80), text(body?.player, 40), expiryFrom(body?.expiresInDays), hands);
  if (Math.random() < 0.05) after(() => store.purge().catch(() => {}));
  return NextResponse.json({ token, ownerToken, url: `${brand.siteUrl}/c/${token}`, hands: hands.length }, { status: 201, headers: coachCors });
}
