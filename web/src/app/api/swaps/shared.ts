import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { loadSwap, publicSwap, swapStore, validId, type Side } from '@/lib/swaps';

export const swapCors = { ...cors, 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS' };
export const noStore = { ...swapCors, 'cache-control': 'no-store' };

/** The swap as the caller sees it: `you` says which side their token is (null without one). */
export async function swapResponse(id: string, token: string, status = 200) {
  const rec = await loadSwap(id);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  const you: Side | null = token && validId(id) ? await swapStore().side(id, token) : null;
  return NextResponse.json({ swap: publicSwap(rec, you) }, { status, headers: noStore });
}

export const tokenOf = (req: Request) => req.headers.get('x-edit-token') ?? '';
