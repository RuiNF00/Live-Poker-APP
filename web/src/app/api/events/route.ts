import { after, NextResponse } from 'next/server';
import { APP_EVENTS, getStore, SERVER_EVENTS, type AppEvent } from '@/lib/store';
import { limited } from '@/lib/abuse';
import { analytics } from '@/lib/analytics';
import { cors } from '@/lib/cors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORMS = ['ios', 'android', 'web'] as const;

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** Keeps props small and flat: at most 16 keys, short strings, numbers and booleans only. */
function cleanProps(raw: unknown): AppEvent['props'] {
  const out: AppEvent['props'] = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, 16)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 120);
    else if ((typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * POST { event, installId (uuid), platform: ios|android|web, props? } → 204.
 * Fire-and-forget funnel events from the app and the site. Rows are write-only for clients.
 */
export async function POST(req: Request) {
  if (await limited(req, 'events', 600, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const event = body?.event as AppEvent['event'];
  const platform = body?.platform as AppEvent['platform'];
  const installId = body?.installId;
  if (
    !APP_EVENTS.includes(event) ||
    SERVER_EVENTS.includes(event) ||
    !PLATFORMS.includes(platform) ||
    typeof installId !== 'string' ||
    !UUID.test(installId)
  ) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 422, headers: cors });
  }
  // Retention backstop for databases without pg_cron (migrations 20261017030000, 20261017090000).
  if (Math.random() < 0.005) after(() => getStore().purgeOldEvents().catch(() => {}));
  const row: AppEvent = { event, installId, platform, props: cleanProps(body?.props) };
  try {
    await getStore().logEvent(row);
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: cors });
  }
  // Optional copy to product analytics, after the response so the app never waits on it.
  const a = analytics();
  if (a) after(() => a.capture(row).catch(() => {}));
  return new NextResponse(null, { status: 204, headers: cors });
}
