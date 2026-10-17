import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { getStore } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

const PUSH_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,128}\]$/;
const LANGS = ['pt-PT', 'pt-BR', 'es', 'en'];

export function OPTIONS() {
  return new NextResponse(null, { headers: { ...cors, 'access-control-allow-methods': 'POST, PATCH, OPTIONS' } });
}

/**
 * POST { pushToken | null, lang, tz } with x-edit-token -> { ok }. The hand's owner turns
 * "Novo comentário" notices on for it, or off with pushToken null. The app sends it only after
 * the player allowed notifications.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'push', 60, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  const b = (await req.json().catch(() => null)) as { pushToken?: unknown; lang?: unknown; tz?: unknown } | null;
  const token = req.headers.get('x-edit-token') ?? '';
  const pushToken = b?.pushToken === null ? null : typeof b?.pushToken === 'string' && PUSH_TOKEN.test(b.pushToken) ? b.pushToken : undefined;
  if (!token || pushToken === undefined) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: cors });
  const lang = typeof b?.lang === 'string' && LANGS.includes(b.lang) ? b.lang : 'en';
  const tz = typeof b?.tz === 'string' && b.tz.length <= 64 ? b.tz : 'UTC';
  const ok = await getStore().setCommentPush(id, token, pushToken, lang, tz);
  return NextResponse.json({ ok }, { status: ok ? 200 : 403, headers: cors });
}

/** PATCH with x-edit-token -> { ok }: the owner opened the hand, so the next comment may notify again. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'push', 60, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  const token = req.headers.get('x-edit-token') ?? '';
  if (!token) return NextResponse.json({ error: 'invalid' }, { status: 422, headers: cors });
  const ok = await getStore().seenCommentPush(id, token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 403, headers: cors });
}
