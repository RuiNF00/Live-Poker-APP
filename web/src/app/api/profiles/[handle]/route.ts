import { NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { handleProblem, normalizeHandle, ownedHands, parseProfile, profileStore } from '@/lib/profiles';

type Ctx = { params: Promise<{ handle: string }> };
const cors2 = { ...cors, 'access-control-allow-methods': 'PUT, DELETE, OPTIONS' };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors2 });
}

/**
 * PUT { profile, hands: [{ id, token }], newHandle? } with header `x-edit-token`: replaces the
 * whole profile (what isn't sent isn't public any more). 404 with a wrong token; 409 when
 * `newHandle` is taken.
 */
export async function PUT(req: Request, { params }: Ctx) {
  const handle = normalizeHandle((await params).handle);
  if (await limited(req, 'profile-update', 120, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors2 });
  const token = req.headers.get('x-edit-token') ?? '';
  const body = (await req.json().catch(() => null)) as { profile?: unknown; hands?: unknown; newHandle?: unknown } | null;
  const profile = parseProfile(body?.profile);
  if (profile === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors2 });
  if (!profile) return NextResponse.json({ error: 'invalid_profile' }, { status: 422, headers: cors2 });
  let newHandle: string | undefined;
  if (body?.newHandle !== undefined) {
    newHandle = normalizeHandle(body.newHandle);
    const problem = handleProblem(newHandle);
    if (problem) return NextResponse.json({ error: `handle_${problem}` }, { status: 422, headers: cors2 });
  }
  if (!token || handleProblem(handle) === 'invalid') return NextResponse.json({ error: 'not_found' }, { status: 404, headers: cors2 });
  const store = profileStore();
  const payload = { ...profile, hands: await ownedHands(body?.hands) };
  if (await store.update(handle, token, payload, newHandle)) {
    const to = newHandle ?? handle;
    return NextResponse.json({ handle: to, url: `${brand.siteUrl}/u/${to}` }, { headers: cors2 });
  }
  // Tell a taken new handle apart from a wrong token.
  const taken = newHandle && newHandle !== handle && !(await store.isFree(newHandle));
  return NextResponse.json({ error: taken ? 'handle_taken' : 'not_found' }, { status: taken ? 409 : 404, headers: cors2 });
}

/** DELETE with header `x-edit-token`: the profile is gone for good (the shared hands stay). */
export async function DELETE(req: Request, { params }: Ctx) {
  const handle = normalizeHandle((await params).handle);
  const token = req.headers.get('x-edit-token') ?? '';
  const ok = !!token && handleProblem(handle) !== 'invalid' && (await profileStore().remove(handle, token));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers: cors2 });
}
