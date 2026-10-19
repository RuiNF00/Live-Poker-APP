import { NextResponse } from 'next/server';
import { BACKUP_ID_RE, BACKUP_SECRET_RE, keyHash } from '@/lib/backups';
import { limited } from '@/lib/abuse';
import { liveEnd, sendEnds, SLOT_RE, TOKEN_RE } from '@/lib/live-end';

// Push-to-end (first update), authorised like the cloud backup: the backup id in the path and the
// key in x-backup-key. PUT {slot, token} registers this phone's Live Activity; POST {slot} ends
// every one registered for that slot. Both → 204, so neither tells whether anything was there.
const ok = () => new NextResponse(null, { status: 204 });
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function read(req: Request, params: Promise<{ id: string }>, bucket: string, max: number) {
  if (await limited(req, `live_end_${bucket}`, max, 3600)) return { error: fail('rate_limited', 429) };
  const id = (await params).id.toUpperCase();
  const secret = (req.headers.get('x-backup-key') ?? '').trim().toUpperCase();
  if (!BACKUP_ID_RE.test(id) || !BACKUP_SECRET_RE.test(secret)) return { error: fail('not_found', 404) };
  const body = (await req.json().catch(() => null)) as { slot?: unknown; token?: unknown } | null;
  const slot = typeof body?.slot === 'string' ? body.slot : '';
  if (!SLOT_RE.test(slot)) return { error: fail('invalid_body', 422) };
  const b = liveEnd();
  if (!b) return { error: fail('unavailable', 503) };
  return { b, id, hash: keyHash(secret), slot, token: typeof body?.token === 'string' ? body.token : '' };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await read(req, params, 'put', 60);
  if (a.error) return a.error;
  if (!TOKEN_RE.test(a.token)) return fail('invalid_body', 422);
  try {
    await a.b.put(a.id, a.hash, a.slot, a.token);
  } catch {
    return fail('unavailable', 503);
  }
  return ok();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await read(req, params, 'post', 120);
  if (a.error) return a.error;
  try {
    await sendEnds(await a.b.take(a.id, a.hash, a.slot));
  } catch {
    return fail('unavailable', 503);
  }
  return ok();
}
