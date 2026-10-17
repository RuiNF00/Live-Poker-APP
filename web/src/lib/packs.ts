import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStore } from './store';
import { serviceClient } from './supabase';
import type { PackHandClaim, PackRecord } from './pack-data';

export * from './pack-data';

// Hand packs (/p/<id>). Supabase in production (migration 20261017220000), a JSON file without it.
// Only the owner of every hand's share link can put it in a pack; the owner token is kept as a hash.

export interface PackStore {
  /** Null when one of the hands isn't the caller's. */
  create(title: string, hands: PackHandClaim[], hideAmounts: boolean): Promise<{ id: string; ownerToken: string } | null>;
  get(id: string): Promise<PackRecord | null>;
  remove(id: string, ownerToken: string): Promise<boolean>;
}

interface Row {
  id: string;
  title: string;
  hand_ids: string[];
  hide_amounts: boolean;
  created_at: string;
}

class SupabasePacks implements PackStore {
  constructor(private db: SupabaseClient) {}

  async create(title: string, hands: PackHandClaim[], hideAmounts: boolean) {
    const { data, error } = await this.db.rpc('create_hand_pack', { p_title: title, p_hands: hands, p_hide: hideAmounts });
    if (error) throw error;
    const r = (data as { id: string; owner_token: string }[] | null)?.[0];
    return r ? { id: r.id, ownerToken: r.owner_token } : null;
  }

  async get(id: string) {
    const { data, error } = await this.db.rpc('get_hand_pack', { p_id: id });
    if (error) throw error;
    const r = (data as Row[] | null)?.[0];
    return r ? { id: r.id, title: r.title, handIds: r.hand_ids, hideAmounts: r.hide_amounts, createdAt: r.created_at } : null;
  }

  async remove(id: string, ownerToken: string) {
    const { data, error } = await this.db.rpc('delete_hand_pack', { p_id: id, p_owner_token: ownerToken });
    if (error) throw error;
    return !!data;
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

class LocalPacks implements PackStore {
  private file = path.join(process.cwd(), '.data', 'packs.json');
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Record<string, PackRecord & { ownerHash: string }>> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch {
      return {};
    }
  }

  private async mutate<T>(fn: (d: Record<string, PackRecord & { ownerHash: string }>) => T): Promise<T> {
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

  async create(title: string, hands: PackHandClaim[], hideAmounts: boolean) {
    const shares = getStore();
    for (const h of hands) if (!(await shares.ownsShare(h.id, h.token))) return null;
    const id = randomBytes(6).toString('hex');
    const ownerToken = randomBytes(32).toString('hex');
    await this.mutate((d) => {
      d[id] = { id, title, handIds: hands.map((h) => h.id), hideAmounts, createdAt: new Date().toISOString(), ownerHash: sha256(ownerToken) };
    });
    return { id, ownerToken };
  }

  async get(id: string) {
    const r = (await this.read())[id];
    if (!r) return null;
    const { ownerHash: _o, ...rec } = r;
    return rec;
  }

  async remove(id: string, ownerToken: string) {
    return this.mutate((d) => {
      if (d[id]?.ownerHash !== sha256(ownerToken)) return false;
      delete d[id];
      return true;
    });
  }
}

let store: PackStore | null = null;

export function packStore(): PackStore {
  if (store) return store;
  const db = serviceClient();
  return (store = db ? new SupabasePacks(db) : new LocalPacks());
}
