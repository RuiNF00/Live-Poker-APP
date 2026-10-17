import { after, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { firstTime, limited, reporterId } from '@/lib/abuse';
import { notifyModeration } from '@/lib/notify';
import { brand } from '@/config/brand';
import { cors } from '@/lib/cors';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST { reason? }: reports a shared hand. Five different reporters (counted by a daily IP
 * hash, never the client's reporterId) hide it for review; it is deleted after 30 days.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (await limited(req, 'report', 20, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 200) : null;
  const result = await getStore().reportHand(id, reporterId(req), reason);
  if (result === 'ok') {
    after(async () => {
      if (await firstTime('report-hand', id)) await notifyModeration(`Nova denúncia: ${brand.siteUrl}/h/${id}`);
    });
  }
  if (result === 'hidden') {
    after(() => notifyModeration(`Mão ${brand.siteUrl}/h/${id} escondida por denúncias. Rever e, se estiver bem, repor com select restore_shared_hand('${id}');`));
  }
  return NextResponse.json({ reported: result !== 'missing' }, { status: result === 'missing' ? 404 : 200, headers: cors });
}
