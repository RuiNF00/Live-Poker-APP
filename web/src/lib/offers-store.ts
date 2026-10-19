import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './supabase';
import { shortId } from './store';
import { termsChanged, type Agreement } from './offer';

export * from './offer';

// Festival action agreements (/o/<id>): one private link per package and backer, where the
// backer confirms the agreed piece. Supabase in production (migration 20261017180000), a
// JSON file without it, with the same rules.

export interface OfferRecord {
  id: string;
  offer: Agreement;
  /** When the backer confirmed these terms; null until then or after new terms. */
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OffersStore {
  create(a: Agreement): Promise<{ id: string; editToken: string }>;
  get(id: string): Promise<OfferRecord | null>;
  /** False with a wrong token or a gone link. New markup or events clear confirmedAt. */
  update(id: string, editToken: string, a: Agreement): Promise<boolean>;
  remove(id: string, editToken: string): Promise<boolean>;
  /**
   * Confirms the terms the backer saw (`seen` = the updatedAt the page showed). Idempotent: keeps
   * the first confirmation. 'stale' when the terms changed since (nothing stamped), null when the
   * link is gone.
   */
  confirm(id: string, seen: string | null): Promise<{ confirmedAt: string } | 'stale' | null>;
  /** Removes agreements 60 days after their last event. */
  purge(): Promise<void>;
}

interface Row {
  id: string;
  payload: Agreement;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

class SupabaseOffers implements OffersStore {
  constructor(private db: SupabaseClient) {}

  async create(a: Agreement) {
    const { data, error } = await this.db.rpc('create_action_offer', { p_payload: a });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { id: row.id as string, editToken: row.edit_token as string };
  }

  async get(id: string) {
    const { data, error } = await this.db.rpc('get_action_offer', { p_id: id });
    if (error) throw error;
    const r = (data as Row[] | null)?.[0];
    return r ? { id: r.id, offer: r.payload, confirmedAt: r.confirmed_at, createdAt: r.created_at, updatedAt: r.updated_at } : null;
  }

  async update(id: string, editToken: string, a: Agreement) {
    const { data, error } = await this.db.rpc('update_action_offer', { p_id: id, p_edit_token: editToken, p_payload: a });
    if (error) throw error;
    return !!data;
  }

  async remove(id: string, editToken: string) {
    const { data, error } = await this.db.rpc('delete_action_offer', { p_id: id, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async confirm(id: string, seen: string | null) {
    const { data, error } = await this.db.rpc('confirm_action_offer', { p_id: id, p_seen: seen });
    if (error) throw error;
    const r = data as { stale?: boolean; confirmed_at?: string } | null;
    if (r?.stale) return 'stale' as const;
    return typeof r?.confirmed_at === 'string' ? { confirmedAt: r.confirmed_at } : null;
  }

  async purge() {
    await this.db.rpc('purge_action_offers');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
type LocalRow = OfferRecord & { editTokenHash: string };

/** The same rules in a JSON file (.data/offers.json by default); writes go through one queue. */
export class LocalOffers implements OffersStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file = path.join(process.cwd(), '.data', 'offers.json')) {}

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

  async create(a: Agreement) {
    const id = shortId();
    const editToken = randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    await this.mutate((d) => {
      d[id] = { id, offer: a, confirmedAt: null, createdAt: now, updatedAt: now, editTokenHash: sha256(editToken) };
    });
    return { id, editToken };
  }

  async get(id: string) {
    await this.queue;
    const r = (await this.read())[id];
    if (!r) return null;
    const { editTokenHash: _, ...rec } = r;
    return rec;
  }

  async update(id: string, editToken: string, a: Agreement) {
    return this.mutate((d) => {
      const r = d[id];
      if (r?.editTokenHash !== sha256(editToken)) return false;
      d[id] = { ...r, offer: a, confirmedAt: termsChanged(r.offer, a) ? null : r.confirmedAt, updatedAt: new Date().toISOString() };
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

  async confirm(id: string, seen: string | null) {
    return this.mutate((d) => {
      const r = d[id];
      if (!r) return null;
      if (!seen || Date.parse(seen) !== Date.parse(r.updatedAt)) return 'stale' as const;
      r.confirmedAt ??= new Date().toISOString();
      return { confirmedAt: r.confirmedAt };
    });
  }

  async purge() {
    const cutoff = Date.now() - 60 * 86400000;
    await this.mutate((d) => {
      for (const [k, v] of Object.entries(d)) if (Math.max(...v.offer.events.map((e) => e.d)) < cutoff) delete d[k];
    });
  }
}

let store: OffersStore | null = null;

export function offersStore(): OffersStore {
  if (store) return store;
  const db = serviceClient();
  return (store = db ? new SupabaseOffers(db) : new LocalOffers());
}

/** Ids are short_id(): 10 characters of base64 without +/=. Anything else is a 404 without a query. */
export const validId = (id: string) => /^[A-Za-z0-9]{6,16}$/.test(id);

export async function loadOffer(id: string): Promise<OfferRecord | null> {
  if (!validId(id)) return null;
  return offersStore().get(id);
}
