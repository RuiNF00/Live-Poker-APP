import { NextResponse } from 'next/server';
import { swapStore, validId } from '@/lib/swaps';
import { swapCors, swapResponse, tokenOf } from '../../../shared';

type Ctx = { params: Promise<{ id: string; entryId: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: swapCors });
}

/** Removes one of your own entries (a typo, a payment that bounced) -> { swap }. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id, entryId } = await params;
  const token = tokenOf(req);
  const ok = !!token && validId(id) && /^[A-Za-z0-9]{1,40}$/.test(entryId) && (await swapStore().removeEntry(id, token, entryId));
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: swapCors });
  return swapResponse(id, token);
}
