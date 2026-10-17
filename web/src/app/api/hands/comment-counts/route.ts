import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';

const ID = /^[A-Za-z0-9_-]{4,32}$/;

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** GET ?ids=a,b,c (up to 100) -> { counts: { a: 3 } }: the app's list of shared hands shows what's new. */
export async function GET(req: Request) {
  if (await limited(req, 'comment-counts', 120, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const ids = [...new Set((new URL(req.url).searchParams.get('ids') ?? '').split(',').filter((x) => ID.test(x)))].slice(0, 100);
  const counts = ids.length ? await getStore().commentCounts(ids) : {};
  return NextResponse.json({ counts }, { headers: { ...cors, 'cache-control': 'no-store' } });
}
