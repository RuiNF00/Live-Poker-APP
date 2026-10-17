import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { OWNER_RE, PACK_ID_RE, packStore } from '@/lib/packs';

type Ctx = { params: Promise<{ id: string }> };
const headers = { ...cors, 'access-control-allow-headers': 'content-type, x-owner-token' };

export function OPTIONS() {
  return new NextResponse(null, { headers });
}

/** DELETE with `x-owner-token`: the pack goes (its hands stay shared on their own links). */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const owner = req.headers.get('x-owner-token') ?? '';
  const ok = PACK_ID_RE.test(id) && OWNER_RE.test(owner) && (await packStore().remove(id, owner));
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404, headers });
}
