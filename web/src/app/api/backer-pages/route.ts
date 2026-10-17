import { after, NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { pageStore } from '@/lib/backer-pages';
import { cors } from '@/lib/cors';
import { createToken } from '@/lib/store';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Makes a backer's fixed link. Called by the app (src/lib/backer-page.ts createBackerPage):
 * POST { token } -> 201 { id, token }. The page starts empty; the app seals and sends it next.
 * The same token again returns the same page.
 */
export async function POST(req: Request) {
  if (await limited(req, 'page-create', 30, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  let token: string | null;
  try {
    token = createToken(body?.token);
  } catch {
    token = null;
  }
  if (!token) return NextResponse.json({ error: 'invalid_token' }, { status: 422, headers: cors });
  const store = pageStore();
  const { id, editToken } = await store.create(token);
  if (Math.random() < 0.02) after(() => store.purge().catch(() => {}));
  return NextResponse.json({ id, token: editToken }, { status: 201, headers: cors });
}
