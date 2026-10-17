import { after, NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { offersStore, parseOffer } from '@/lib/offers-store';

const cors2 = { ...cors, 'access-control-allow-methods': 'POST, OPTIONS' };
const noStore = { ...cors2, 'cache-control': 'no-store' };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors2 });
}

/**
 * Records a festival action agreement for one backer. Called by the app (src/lib/offer-api.ts):
 * POST { offer } -> 201 { id, token, url }. The app keeps `token` to edit or delete it;
 * the url goes privately to that backer, who confirms the agreed piece there.
 */
export async function POST(req: Request) {
  if (await limited(req, 'offer-create', 20, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  }
  const body = (await req.json().catch(() => null)) as { offer?: unknown } | null;
  const offer = parseOffer(body?.offer);
  if (offer === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: noStore });
  if (!offer) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: noStore });
  const store = offersStore();
  const { id, editToken } = await store.create(offer);
  if (Math.random() < 0.02) after(() => store.purge().catch(() => {}));
  return NextResponse.json({ id, token: editToken, url: `${brand.siteUrl}/o/${id}` }, { status: 201, headers: noStore });
}
