import { after, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { firstTime, limited, reporterId } from '@/lib/abuse';
import { notifyModeration } from '@/lib/notify';
import { brand } from '@/config/brand';
import { cors } from '@/lib/cors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** POST: reports an abusive comment; three different reporters (daily IP hash) hide it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await params;
  if (await limited(req, 'report', 20, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  if (!UUID.test(commentId)) return NextResponse.json({ error: 'invalid_report' }, { status: 422, headers: cors });
  const result = await getStore().reportComment(commentId, reporterId(req));
  if (result === 'ok') {
    after(async () => {
      if (await firstTime('report-comment', commentId)) await notifyModeration(`Nova denúncia: ${brand.siteUrl}/h/${id}`);
    });
  }
  if (result === 'hidden') after(() => notifyModeration(`Comentário escondido por denúncias em ${brand.siteUrl}/h/${id}.`));
  return NextResponse.json({ reported: result !== 'missing' }, { status: result === 'missing' ? 404 : 200, headers: cors });
}
