import { after, NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { firstTime, limited, reporterId } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { notifyModeration } from '@/lib/notify';
import { normalizeHandle, profileStore } from '@/lib/profiles';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * POST: reports a profile. Three different reporters (counted by a daily IP hash) hide it
 * for review; it is deleted after 30 days unless restored.
 */
export async function POST(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const handle = normalizeHandle((await params).handle);
  if (await limited(req, 'report', 20, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const result = await profileStore().report(handle, reporterId(req));
  if (result === 'ok') {
    after(async () => {
      if (await firstTime('report-profile', handle)) await notifyModeration(`Nova denúncia: ${brand.siteUrl}/u/${handle}`);
    });
  }
  if (result === 'hidden') {
    after(() => notifyModeration(`Perfil ${brand.siteUrl}/u/${handle} escondido por denúncias. Rever e, se estiver bem, repor com select restore_profile('${handle}');`));
  }
  return NextResponse.json({ reported: result !== 'missing' }, { status: result === 'missing' ? 404 : 200, headers: cors });
}
