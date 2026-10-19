import { after, NextResponse } from 'next/server';
import { BACKUP_ID_RE, BACKUP_MAX_BYTES, BACKUP_SECRET_RE, backups, keyHash, type BackupType } from '@/lib/backups';
import { limited } from '@/lib/abuse';

// Cloud backup by recovery code. The secret travels only in the x-backup-key header.
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, content-encoding, x-backup-key',
  'access-control-expose-headers': 'x-updated-at',
};
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: cors });

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

async function auth(req: Request, params: Promise<{ id: string }>, bucket: string, max: number) {
  if (await limited(req, `backup_${bucket}`, max, 3600)) return { error: fail('rate_limited', 429) };
  const b = backups();
  if (!b) return { error: fail('backups_disabled', 503) };
  const id = (await params).id.toUpperCase();
  const secret = (req.headers.get('x-backup-key') ?? '').trim().toUpperCase();
  if (!BACKUP_ID_RE.test(id) || !BACKUP_SECRET_RE.test(secret)) return { error: fail('not_found', 404) };
  return { b, id, hash: keyHash(secret) };
}

/**
 * Body: gzip (detected by its magic bytes) or plain JSON, up to 2 MB → 204. 403 if the id has
 * another secret, 507 when the server's storage quota is full (try again later).
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await auth(req, params, 'put', 30);
  if (a.error) return a.error;
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > BACKUP_MAX_BYTES) return fail('too_large', 413);
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length === 0) return fail('empty', 422);
  if (data.length > BACKUP_MAX_BYTES) return fail('too_large', 413);
  let type: BackupType = 'application/gzip';
  if (!(data[0] === 0x1f && data[1] === 0x8b)) {
    try {
      JSON.parse(data.toString('utf8'));
      type = 'application/json';
    } catch {
      return fail('invalid_body', 422);
    }
  }
  // Expiry backstop for databases without pg_cron.
  if (Math.random() < 0.01) after(() => a.b.purgeOld().catch(() => {}));
  try {
    if (!(await a.b.put(a.id, a.hash, data, type))) return fail('forbidden', 403);
  } catch (e) {
    if (String((e as Error)?.message).includes('quota')) return fail('quota', 507);
    return fail('unavailable', 503);
  }
  return new NextResponse(null, { status: 204, headers: cors });
}

/** → the stored body (its original content type) with x-updated-at; 404 for a wrong code or no backup. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await auth(req, params, 'get', 60);
  if (a.error) return a.error;
  try {
    const found = await a.b.get(a.id, a.hash);
    if (!found) return fail('not_found', 404);
    return new NextResponse(new Uint8Array(found.data), {
      headers: { ...cors, 'content-type': found.contentType, 'x-updated-at': found.updatedAt, 'cache-control': 'no-store' },
    });
  } catch {
    return fail('unavailable', 503);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await auth(req, params, 'delete', 30);
  if (a.error) return a.error;
  try {
    if (!(await a.b.remove(a.id, a.hash))) return fail('not_found', 404);
  } catch {
    return fail('unavailable', 503);
  }
  return new NextResponse(null, { status: 204, headers: cors });
}
