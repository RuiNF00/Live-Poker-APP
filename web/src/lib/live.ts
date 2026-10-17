import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './supabase';
import { shortId } from './store';
import type { LiveSnapshot } from './live-snapshot';

export { parseSnapshot, type LiveSnapshot } from './live-snapshot';

// Backer live links (/live/<id>): one snapshot per link, replaced by the app as the
// session changes. Supabase in production (migration 20261017120000), a JSON file
// without it.

export interface LiveRecord {
  id: string;
  snapshot: LiveSnapshot;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiveStore {
  create(s: LiveSnapshot): Promise<{ id: string; editToken: string }>;
  get(id: string): Promise<LiveRecord | null>;
  /** False with a wrong token or a link that is gone. */
  update(id: string, editToken: string, s: LiveSnapshot): Promise<boolean>;
  remove(id: string, editToken: string): Promise<boolean>;
  recordView(id: string): Promise<void>;
  /** Removes links not updated for 30 days. */
  purge(): Promise<void>;
}

interface Row {
  id: string;
  payload: LiveSnapshot;
  view_count: number;
  created_at: string;
  updated_at: string;
}

class SupabaseLive implements LiveStore {
  constructor(private db: SupabaseClient) {}

  async create(s: LiveSnapshot) {
    const { data, error } = await this.db.rpc('create_live_session', { p_payload: s });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { id: row.id as string, editToken: row.edit_token as string };
  }

  async get(id: string) {
    const { data, error } = await this.db.rpc('get_live_session', { p_id: id });
    if (error) throw error;
    const r = (data as Row[] | null)?.[0];
    return r ? { id: r.id, snapshot: r.payload, viewCount: r.view_count, createdAt: r.created_at, updatedAt: r.updated_at } : null;
  }

  async update(id: string, editToken: string, s: LiveSnapshot) {
    const { data, error } = await this.db.rpc('update_live_session', { p_id: id, p_edit_token: editToken, p_payload: s });
    if (error) throw error;
    return !!data;
  }

  async remove(id: string, editToken: string) {
    const { data, error } = await this.db.rpc('delete_live_session', { p_id: id, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async recordView(id: string) {
    await this.db.rpc('record_live_view', { p_id: id });
  }

  async purge() {
    await this.db.rpc('purge_live_sessions');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
type LocalRow = LiveRecord & { editTokenHash: string };

class LocalLive implements LiveStore {
  private file = path.join(process.cwd(), '.data', 'live.json');
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Record<string, LocalRow>> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch {
      return {};
    }
  }

  private async mutate<T>(fn: (d: Record<string, LocalRow>) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const d = await this.read();
      const out = fn(d);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(d, null, 2));
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async create(s: LiveSnapshot) {
    const id = shortId();
    const editToken = randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    await this.mutate((d) => {
      d[id] = { id, snapshot: s, viewCount: 0, createdAt: now, updatedAt: now, editTokenHash: sha256(editToken) };
    });
    return { id, editToken };
  }

  async get(id: string) {
    const r = (await this.read())[id];
    if (!r) return null;
    const { editTokenHash: _, ...rec } = r;
    return rec;
  }

  async update(id: string, editToken: string, s: LiveSnapshot) {
    return this.mutate((d) => {
      if (d[id]?.editTokenHash !== sha256(editToken)) return false;
      d[id] = { ...d[id], snapshot: s, updatedAt: new Date().toISOString() };
      return true;
    });
  }

  async remove(id: string, editToken: string) {
    return this.mutate((d) => {
      if (d[id]?.editTokenHash !== sha256(editToken)) return false;
      delete d[id];
      return true;
    });
  }

  async recordView(id: string) {
    await this.mutate((d) => {
      if (d[id]) d[id].viewCount++;
    });
  }

  async purge() {
    const cutoff = Date.now() - 30 * 86400000;
    await this.mutate((d) => {
      for (const [k, v] of Object.entries(d)) if (Date.parse(v.updatedAt) < cutoff) delete d[k];
    });
  }
}

let store: LiveStore | null = null;

export function liveStore(): LiveStore {
  if (store) return store;
  const db = serviceClient();
  return (store = db ? new SupabaseLive(db) : new LocalLive());
}

/** Ids are short_id(): 10 characters of base64 without +/=. Anything else is a 404 without a query. */
export const validId = (id: string) => /^[A-Za-z0-9]{6,16}$/.test(id);

export async function loadLive(id: string): Promise<LiveRecord | null> {
  if (!validId(id)) return null;
  return liveStore().get(id);
}
