import { NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { groupStore, loadGroup, publicGroup } from '@/lib/swap-groups';
import { groupCreatorPro } from '@/lib/swap-pro';

export const groupCors = { ...cors, 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
export const noStore = { ...groupCors, 'cache-control': 'no-store' };
export const validGroupId = (id: string) => /^[A-Za-z0-9]{6,16}$/.test(id);

/**
 * The group as the caller sees it: `you` is the seat of their token (null without one). Only
 * a player in it gets `accounts`: whether the settlement is open because the creator has Pro.
 */
export async function groupResponse(id: string, token: string, status = 200, extra: Record<string, unknown> = {}) {
  const rec = await loadGroup(id);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore });
  const you = token && validGroupId(id) ? await groupStore().seat(id, token) : null;
  const accounts = you !== null ? { accounts: await groupCreatorPro(id) } : {};
  return NextResponse.json({ ...extra, ...accounts, group: publicGroup(rec, you) }, { status, headers: noStore });
}

export const tokenOf = (req: Request) => req.headers.get('x-edit-token') ?? '';
