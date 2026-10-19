import { NextResponse } from 'next/server';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { handleProblem, normalizeHandle, profileStore } from '@/lib/profiles';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/** GET ?handle=x -> { handle, ok, problem? }: can this handle be taken right now? */
export async function GET(req: Request) {
  if (await limited(req, 'profile-check', 120, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const handle = normalizeHandle(new URL(req.url).searchParams.get('handle'));
  const problem = handleProblem(handle) ?? ((await profileStore().isFree(handle)) ? null : 'taken');
  return NextResponse.json({ handle, ok: !problem, ...(problem ? { problem } : {}) }, { headers: { ...cors, 'cache-control': 'no-store' } });
}
