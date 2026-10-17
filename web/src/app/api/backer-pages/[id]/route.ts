import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { pageStore, parseSealed, validId } from '@/lib/backer-pages';
import { cors } from '@/lib/cors';
import { clientIp, rateLimited } from '@/lib/ratelimit';

type Ctx = { params: Promise<{ id: string }> };

const cors2 = { ...cors, 'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS' };
const noStore = { ...cors2, 'cache-control': 'no-store' };

export function OPTIONS() {
  return new NextResponse(null, { headers: cors2 });
}

/** The sealed page, polled by /b (every 60 s per open tab). Only someone with the link's key can read it. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (rateLimited(`page-read:${clientIp(req)}`, 2000, 3600 * 1000)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: noStore });
  const rec = validId(id) ? await pageStore().get(id) : null;
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  return NextResponse.json({ sealed: rec.sealed, updatedAt: rec.updatedAt }, { headers: noStore });
}

/** PUT { sealed } with header `x-edit-token`. 404 when the page is gone or the token is wrong. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'page-update', 600, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors2 });
  const token = req.headers.get('x-edit-token') ?? '';
  const body = (await req.json().catch(() => null)) as { sealed?: unknown } | null;
  const sealed = parseSealed(body?.sealed);
  if (!sealed) return NextResponse.json({ error: 'invalid_page' }, { status: 422, headers: cors2 });
  const ok = !!token && validId(id) && (await pageStore().update(id, token, sealed));
  return NextResponse.json({ updated: ok }, { status: ok ? 200 : 404, headers: cors2 });
}

/** DELETE with header `x-edit-token`: the link stops opening for the backer. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const token = req.headers.get('x-edit-token') ?? '';
  const ok = !!token && validId(id) && (await pageStore().remove(id, token));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers: cors2 });
}
