import { timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { analytics } from '@/lib/analytics';
import { funnelFrom, installIdForRc, type RcWebhookEvent } from '@/lib/rc-webhook';
import { referrals } from '@/lib/referrals';
import { getStore, type AppEvent } from '@/lib/store';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * POST from RevenueCat's webhook (Integrations › Webhooks, Authorization header set to
 * REVENUECAT_WEBHOOK_AUTH). Records trial_end, store_purchase and sub_cancel (rc-webhook.ts), so
 * the funnel counts what the stores saw, including players who never open the app again.
 * Closed when the secret isn't set.
 */
export async function POST(req: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!secret) return NextResponse.json({ error: 'disabled' }, { status: 503 });
  if (!same(req.headers.get('authorization') ?? '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { event?: RcWebhookEvent } | null;
  const t = funnelFrom(body?.event);
  // Acknowledge anything we don't record, so RevenueCat doesn't retry it.
  if (!t) return new NextResponse(null, { status: 204 });
  try {
    const installId = (await referrals()?.installFor(t.appUserId).catch(() => null)) ?? (await installIdForRc(t.appUserId));
    const row: AppEvent = { event: t.event, installId, platform: t.platform, props: t.props };
    await getStore().logEvent(row);
    const a = analytics();
    if (a) after(() => a.capture(row).catch(() => {}));
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  return new NextResponse(null, { status: 204 });
}
