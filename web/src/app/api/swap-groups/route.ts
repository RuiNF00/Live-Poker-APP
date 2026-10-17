import { after, NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { groupStore, parseGroup, publicGroup } from '@/lib/swap-groups';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Creates a group swap. Called by the app (src/lib/swap-api.ts createGroup):
 * POST { terms, names } -> 201 { id, token, invite, url, group }. The creator is seat 0 (names[0]).
 * The app keeps `token`; `url` carries the invite in its fragment for the others.
 */
export async function POST(req: Request) {
  if (await limited(req, 'swap-create', 30, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  const body = (await req.json().catch(() => null)) as { terms?: unknown; names?: unknown } | null;
  const g = parseGroup(body?.terms, body?.names);
  if (g === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors });
  if (!g) return NextResponse.json({ error: 'invalid_terms' }, { status: 422, headers: cors });
  const store = groupStore();
  const { id, token, invite } = await store.create(g.terms, g.names);
  if (Math.random() < 0.02) after(() => store.purge().catch(() => {}));
  const rec = await store.get(id);
  return NextResponse.json(
    { id, token, invite, url: `${brand.siteUrl}/swap/g/${id}#i=${invite}`, group: rec && publicGroup(rec, 0) },
    { status: 201, headers: cors },
  );
}
