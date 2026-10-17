import 'server-only';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cloud backup keyed by a recovery code <id>-<secret> (see migration 20261017050000).
// Only sha256(secret) is stored. Server-only: the table is closed to app/browser keys.

export const BACKUP_ID_RE = /^[0-9A-HJKMNP-TV-Z]{10}$/;
export const BACKUP_SECRET_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
/** Vercel caps a function's request body at 4.5 MB; stay under it. */
export const BACKUP_MAX_BYTES = 4_400_000;

export type BackupType = 'application/json' | 'application/gzip';
export interface StoredBackup {
  data: Buffer;
  contentType: BackupType;
  updatedAt: string;
}

export const keyHash = (secret: string) => createHash('sha256').update(secret).digest('hex');

interface BackupBackend {
  /** false when the id exists under another secret */
  put(id: string, hash: string, data: Buffer, type: BackupType): Promise<boolean>;
  get(id: string, hash: string): Promise<StoredBackup | null>;
  remove(id: string, hash: string): Promise<boolean>;
  purgeOld(): Promise<void>;
}

class SupabaseBackups implements BackupBackend {
  constructor(private db: SupabaseClient) {}
  async put(id: string, hash: string, data: Buffer, type: BackupType) {
    const { data: ok, error } = await this.db.rpc('put_app_backup', {
      p_id: id,
      p_key_hash: hash,
      p_data_b64: data.toString('base64'),
      p_content_type: type,
    });
    if (error) throw error;
    return !!ok;
  }
  async get(id: string, hash: string) {
    const { data, error } = await this.db.rpc('get_app_backup', { p_id: id, p_key_hash: hash });
    if (error) throw error;
    const row = (data as { data_b64: string; content_type: BackupType; updated_at: string }[] | null)?.[0];
    return row ? { data: Buffer.from(row.data_b64, 'base64'), contentType: row.content_type, updatedAt: row.updated_at } : null;
  }
  async remove(id: string, hash: string) {
    const { data, error } = await this.db.rpc('delete_app_backup', { p_id: id, p_key_hash: hash });
    if (error) throw error;
    return !!data;
  }
  async purgeOld() {
    await this.db.rpc('purge_old_app_backups');
  }
}

/** Development without Supabase: one file per backup under .data/backups. */
class LocalBackups implements BackupBackend {
  private dir = path.join(process.cwd(), '.data', 'backups');
  private file = (id: string) => path.join(this.dir, `${id}.json`);
  private async load(id: string) {
    try {
      return JSON.parse(await fs.readFile(this.file(id), 'utf8')) as { hash: string; b64: string; type: BackupType; updatedAt: string };
    } catch {
      return null;
    }
  }
  async put(id: string, hash: string, data: Buffer, type: BackupType) {
    const cur = await this.load(id);
    if (cur && cur.hash !== hash) return false;
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file(id), JSON.stringify({ hash, b64: data.toString('base64'), type, updatedAt: new Date().toISOString() }));
    return true;
  }
  async get(id: string, hash: string) {
    const cur = await this.load(id);
    return cur && cur.hash === hash ? { data: Buffer.from(cur.b64, 'base64'), contentType: cur.type, updatedAt: cur.updatedAt } : null;
  }
  async remove(id: string, hash: string) {
    const cur = await this.load(id);
    if (!cur || cur.hash !== hash) return false;
    await fs.rm(this.file(id), { force: true });
    return true;
  }
  async purgeOld() {}
}

let backend: BackupBackend | null | undefined;

/** null when Supabase is configured without the service role key: backups are then off. */
export function backups(): BackupBackend | null {
  if (backend !== undefined) return backend;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  backend = url && service ? new SupabaseBackups(createClient(url, service, { auth: { persistSession: false } })) : url ? null : new LocalBackups();
  return backend;
}
