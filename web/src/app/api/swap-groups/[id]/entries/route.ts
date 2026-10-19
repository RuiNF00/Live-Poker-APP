import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { groupStore, parseGroupEntry } from '@/lib/swap-groups';
import { groupCors, groupResponse, tokenOf, validGroupId } from '../../shared';

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { headers: groupCors });
}

/**
 * Adds a prize you won or a payment you made (to another seat), for your seat only:
 * POST { entry: { cid, kind, amount, event?, finish?, to? } } -> { group }. 409 until every seat is taken.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (await limited(req, 'swap-entry', 300, 3600)) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: groupCors });
  const token = tokenOf(req);
  const body = (await req.json().catch(() => null)) as { entry?: unknown } | null;
  const entry = parseGroupEntry(body?.entry);
  if (entry === 'offensive') return NextResponse.json({ error: 'offensive' }, { status: 422, headers: groupCors });
  if (!entry) return NextResponse.json({ error: 'invalid_entry' }, { status: 422, headers: groupCors });
  if (!token || !validGroupId(id)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: groupCors });
  const store = groupStore();
  if ((await store.seat(id, token)) === null) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: groupCors });
  const ok = await store.addEntry(id, token, entry);
  if (!ok) return NextResponse.json({ error: 'not_confirmed' }, { status: 409, headers: groupCors });
  return groupResponse(id, token);
}
