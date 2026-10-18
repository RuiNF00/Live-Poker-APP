import { after, NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { handleProblem, normalizeHandle, ownedHands, parseProfile, profileStore } from '@/lib/profiles';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Creates a public profile. Called by the app (src/lib/profile-api.ts):
 * POST { handle, profile, hands: [{ id, token }] } -> 201 { handle, token, url }.
 * 409 when the handle is taken; 422 with `error` for a bad handle or profile.
 */
export async function POST(req: Request) {
  if (await limited(req, 'profile-create', 10, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { handle?: unknown; profile?: unknown; hands?: unknown } | null;
  const handle = normalizeHandle(body?.handle);
  const problem = handleProblem(handle);
  if (problem) return NextResponse.json({ error: `handle_${problem}` }, { status: 422, headers: cors });
  const profile = parseProfile(body?.profile);
  if (profile === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors });
  if (!profile) return NextResponse.json({ error: 'invalid_profile' }, { status: 422, headers: cors });
  const store = profileStore();
  const token = await store.create(handle, { ...profile, hands: await ownedHands(body?.hands) });
  if (!token) return NextResponse.json({ error: 'handle_taken' }, { status: 409, headers: cors });
  if (Math.random() < 0.05) after(() => store.purge().catch(() => {}));
  return NextResponse.json({ handle, token, url: `${brand.siteUrl}/u/${handle}` }, { status: 201, headers: cors });
}
