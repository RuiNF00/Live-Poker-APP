import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

/** DELETE with header `x-edit-token` (returned when the share was created). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('x-edit-token') ?? '';
  const ok = token ? await getStore().deleteShare(id, token) : false;
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 403 });
}
