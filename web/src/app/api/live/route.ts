import { after, NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { liveStore, parseSnapshot } from '@/lib/live';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Creates a backer live link. Called by the app (src/lib/live-link.ts createLive):
 * POST { snapshot } -> 201 { id, token, url }. The app keeps `token` to update or remove it.
 */
export async function POST(req: Request) {
  if (await limited(req, 'live-create', 20, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { snapshot?: unknown } | null;
  const snap = parseSnapshot(body?.snapshot);
  if (snap === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors });
  if (!snap) return NextResponse.json({ error: 'invalid_snapshot' }, { status: 422, headers: cors });
  const store = liveStore();
  const { id, editToken } = await store.create(snap);
  if (Math.random() < 0.02) after(() => store.purge().catch(() => {}));
  return NextResponse.json({ id, token: editToken, url: `${brand.siteUrl}/live/${id}` }, { status: 201, headers: cors });
}
