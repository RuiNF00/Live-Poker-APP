import { after, NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { rcUserIdOf } from '@/lib/swap-pro';
import { parseTerms, publicSwap, swapStore } from '@/lib/swaps';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Proposes a swap. Called by the app (src/lib/swap-api.ts createSwap):
 * POST { terms, rcUserId? } -> 201 { id, token, url, swap }. The app keeps `token` (side 'a').
 * `rcUserId` is the creator's RevenueCat id: with Pro, everyone in the swap sees the accounts.
 */
export async function POST(req: Request) {
  if (await limited(req, 'swap-create', 30, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { terms?: unknown; rcUserId?: unknown } | null;
  const terms = parseTerms(body?.terms);
  if (terms === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: cors });
  if (!terms) return NextResponse.json({ error: 'invalid_terms' }, { status: 422, headers: cors });
  const store = swapStore();
  const { id, token } = await store.create(terms);
  const rc = rcUserIdOf(body?.rcUserId);
  if (rc) await store.setOwnerRc(id, token, rc).catch(() => false);
  if (Math.random() < 0.02) after(() => store.purge().catch(() => {}));
  const rec = await store.get(id);
  return NextResponse.json({ id, token, url: `${brand.siteUrl}/swap/${id}`, swap: rec && publicSwap(rec, 'a') }, { status: 201, headers: cors });
}
