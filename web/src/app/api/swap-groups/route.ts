import { after, NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { groupStore, parseGroup, publicGroup } from '@/lib/swap-groups';
import { rcUserIdOf } from '@/lib/swap-pro';
import { ownToken } from '@/lib/swaps';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Creates a group swap. Called by the app (src/lib/swap-api.ts createGroup):
 * POST { terms, names, rcUserId?, token?, invite? } -> 201 { id, token, invite, url, group }. The creator is seat 0 (names[0]);
 * with Pro on `rcUserId` (their RevenueCat id), everyone in the group sees the accounts.
 * The app keeps `token`; `url` carries the invite in its fragment for the others. `token` and `invite`
 * are the app's own picks for this draft: sending the same create again returns the same group.
 */
export async function POST(req: Request) {
  if (await limited(req, 'swap-create', 30, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  const body = (await req.json().catch(() => null)) as { terms?: unknown; names?: unknown; rcUserId?: unknown; token?: unknown; invite?: unknown } | null;
  const g = parseGroup(body?.terms, body?.names);
  if (g === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors });
  if (!g) return NextResponse.json({ error: 'invalid_terms' }, { status: 422, headers: cors });
  const store = groupStore();
  const ownT = ownToken(body?.token);
  const ownI = ownToken(body?.invite);
  const { id, token, invite } = await store.create(g.terms, g.names, ownT && ownI && ownT !== ownI ? { token: ownT, invite: ownI } : undefined);
  const rc = rcUserIdOf(body?.rcUserId);
  if (rc) await store.setOwnerRc(id, token, rc).catch(() => false);
  if (Math.random() < 0.02) after(() => store.purge().catch(() => {}));
  const rec = await store.get(id);
  return NextResponse.json(
    { id, token, invite, url: `${brand.siteUrl}/swap/g/${id}#i=${invite}`, group: rec && publicGroup(rec, 0) },
    { status: 201, headers: cors },
  );
}
