import 'server-only';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './supabase';
import { shortId } from './store';
import { parseSealed, type Sealed } from './sealed';

export { parseSealed, type Sealed } from './sealed';

// Backers' fixed links (/b#s=<id>.<key>): one sealed page per player and backer, replaced
// by the app as sessions and payments change. The server can't read them (the key is
// only in the link). Supabase in production (migration 20261017370000), a JSON file without it.

export interface PageRecord {
  id: string;
  sealed: Sealed | null;
  updatedAt: string;
}

export interface PageStore {
  /** `token`: the app's own (64 hex), so a create sent again returns the same page. */
  create(token: string): Promise<{ id: string; editToken: string }>;
  get(id: string): Promise<PageRecord | null>;
  /** False with a wrong token or a page that is gone. */
  update(id: string, editToken: string, s: Sealed): Promise<boolean>;
  remove(id: string, editToken: string): Promise<boolean>;
  /** Removes pages not updated for 180 days. */
  purge(): Promise<void>;
}

class SupabasePages implements PageStore {
  constructor(private db: SupabaseClient) {}

  async create(token: string) {
    const { data, error } = await this.db.rpc('create_backer_page', { p_token: token });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { id: row.id as string, editToken: row.edit_token as string };
  }

  async get(id: string) {
    const { data, error } = await this.db.rpc('get_backer_page', { p_id: id });
    if (error) throw error;
    const r = (data as { id: string; sealed: Sealed | null; updated_at: string }[] | null)?.[0];
    return r ? { id: r.id, sealed: r.sealed, updatedAt: r.updated_at } : null;
  }

  async update(id: string, editToken: string, s: Sealed) {
    const { data, error } = await this.db.rpc('update_backer_page', { p_id: id, p_edit_token: editToken, p_sealed: s });
    if (error) throw error;
    return !!data;
  }

  async remove(id: string, editToken: string) {
    const { data, error } = await this.db.rpc('delete_backer_page', { p_id: id, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async purge() {
    await this.db.rpc('purge_backer_pages');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
type LocalRow = PageRecord & { editTokenHash: string };

class LocalPages implements PageStore {
  private file = path.join(process.cwd(), '.data', 'backer-pages.json');
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

  async create(token: string) {
    return this.mutate((d) => {
      const again = Object.values(d).find((r) => r.editTokenHash === sha256(token));
      if (again) return { id: again.id, editToken: token };
      const id = shortId();
      d[id] = { id, sealed: null, updatedAt: new Date().toISOString(), editTokenHash: sha256(token) };
      return { id, editToken: token };
    });
  }

  async get(id: string) {
    const r = (await this.read())[id];
    if (!r) return null;
    const { editTokenHash: _, ...rec } = r;
    return rec;
  }

  async update(id: string, editToken: string, s: Sealed) {
    return this.mutate((d) => {
      if (d[id]?.editTokenHash !== sha256(editToken)) return false;
      d[id] = { ...d[id], sealed: s, updatedAt: new Date().toISOString() };
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

  async purge() {
    const cutoff = Date.now() - 180 * 86400000;
    await this.mutate((d) => {
      for (const [k, v] of Object.entries(d)) if (Date.parse(v.updatedAt) < cutoff) delete d[k];
    });
  }
}

let store: PageStore | null = null;

export function pageStore(): PageStore {
  if (store) return store;
  const db = serviceClient();
  return (store = db ? new SupabasePages(db) : new LocalPages());
}

/** Ids are short_id(): anything else is a 404 without a query. */
export const validId = (id: string) => /^[A-Za-z0-9]{6,16}$/.test(id);
