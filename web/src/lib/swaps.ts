import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './supabase';
import { shortId } from './store';
import type { PublicSwap, Side, SwapEntry, SwapRecord, SwapTerms } from './swap-terms';

export * from './swap-terms';

// Swaps between players (/swap/<id>). Supabase in production (migration 20261017160000), a JSON
// file without it. The database functions enforce the rules: terms never change, the other
// player confirms once, and each side only adds or removes its own entries.

type NewEntry = Omit<SwapEntry, 'id' | 'side' | 'at'>;

export interface SwapStore {
  create(t: SwapTerms): Promise<{ id: string; token: string }>;
  get(id: string): Promise<SwapRecord | null>;
  side(id: string, token: string): Promise<Side | null>;
  /** The other side's token, or null when it was already confirmed or is gone. */
  confirm(id: string, name: string): Promise<string | null>;
  addEntry(id: string, token: string, e: NewEntry): Promise<boolean>;
  removeEntry(id: string, token: string, entryId: string): Promise<boolean>;
  remove(id: string, token: string): Promise<boolean>;
  /** "Delete all my data": this side leaves; the other keeps a read-only record. */
  leave(id: string, token: string): Promise<boolean>;
  purge(): Promise<void>;
}

interface Row {
  id: string;
  terms: SwapTerms;
  confirmed_at: string | null;
  confirmed_name: string | null;
  entries: SwapEntry[];
  created_at: string;
  updated_at: string;
  left_side?: Side | null;
}

class SupabaseSwaps implements SwapStore {
  constructor(private db: SupabaseClient) {}

  async create(t: SwapTerms) {
    const { data, error } = await this.db.rpc('create_swap', { p_terms: t });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { id: row.id as string, token: row.token as string };
  }

  async get(id: string) {
    const { data, error } = await this.db.rpc('get_swap', { p_id: id });
    if (error) throw error;
    const r = (data as Row[] | null)?.[0];
    return r
      ? { id: r.id, terms: r.terms, confirmedAt: r.confirmed_at, confirmedName: r.confirmed_name, entries: r.entries ?? [], createdAt: r.created_at, updatedAt: r.updated_at, leftSide: r.left_side ?? null }
      : null;
  }

  async side(id: string, token: string) {
    const { data, error } = await this.db.rpc('swap_side', { p_id: id, p_token: token });
    if (error) throw error;
    return data === 'a' || data === 'b' ? data : null;
  }

  async confirm(id: string, name: string) {
    const { data, error } = await this.db.rpc('confirm_swap', { p_id: id, p_name: name });
    if (error) throw error;
    return typeof data === 'string' && data ? data : null;
  }

  async addEntry(id: string, token: string, e: NewEntry) {
    const { data, error } = await this.db.rpc('add_swap_entry', { p_id: id, p_token: token, p_entry: e });
    if (error) throw error;
    return !!data;
  }

  async removeEntry(id: string, token: string, entryId: string) {
    const { data, error } = await this.db.rpc('remove_swap_entry', { p_id: id, p_token: token, p_entry_id: entryId });
    if (error) throw error;
    return !!data;
  }

  async remove(id: string, token: string) {
    const { data, error } = await this.db.rpc('delete_swap', { p_id: id, p_token: token });
    if (error) throw error;
    return !!data;
  }

  async leave(id: string, token: string) {
    const { data, error } = await this.db.rpc('leave_swap', { p_id: id, p_token: token });
    if (error) throw error;
    return !!data;
  }

  async purge() {
    await this.db.rpc('purge_swaps');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
type LocalRow = SwapRecord & { aHash: string; bHash: string | null };

class LocalSwaps implements SwapStore {
  private file = path.join(process.cwd(), '.data', 'swaps.json');
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

  private sideOf(r: LocalRow | undefined, token: string): Side | null {
    if (!r || !token) return null;
    if (r.aHash === sha256(token)) return 'a';
    if (r.bHash && r.bHash === sha256(token)) return 'b';
    return null;
  }

  async create(terms: SwapTerms) {
    const id = shortId();
    const token = randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    await this.mutate((d) => {
      d[id] = { id, terms, confirmedAt: null, confirmedName: null, entries: [], createdAt: now, updatedAt: now, aHash: sha256(token), bHash: null };
    });
    return { id, token };
  }

  async get(id: string) {
    const r = (await this.read())[id];
    if (!r) return null;
    const { aHash: _a, bHash: _b, ...rec } = r;
    return rec;
  }

  async side(id: string, token: string) {
    return this.sideOf((await this.read())[id], token);
  }

  async confirm(id: string, name: string) {
    return this.mutate((d) => {
      const r = d[id];
      if (!r || r.confirmedAt) return null;
      const token = randomBytes(32).toString('hex');
      const now = new Date().toISOString();
      d[id] = { ...r, bHash: sha256(token), confirmedAt: now, confirmedName: name, updatedAt: now };
      return token;
    });
  }

  async addEntry(id: string, token: string, e: NewEntry) {
    return this.mutate((d) => {
      const r = d[id];
      const side = this.sideOf(r, token);
      if (!r || !side || !r.confirmedAt || r.leftSide) return false;
      if (r.entries.some((x) => x.side === side && x.cid === e.cid)) return true;
      r.entries.push({ ...e, id: randomBytes(6).toString('hex'), side, at: Date.now() });
      r.updatedAt = new Date().toISOString();
      return true;
    });
  }

  async removeEntry(id: string, token: string, entryId: string) {
    return this.mutate((d) => {
      const r = d[id];
      const side = this.sideOf(r, token);
      if (!r || !side) return false;
      const n = r.entries.length;
      r.entries = r.entries.filter((x) => !(x.id === entryId && x.side === side));
      r.updatedAt = new Date().toISOString();
      return r.entries.length < n;
    });
  }

  async remove(id: string, token: string) {
    return this.mutate((d) => {
      if (!this.sideOf(d[id], token)) return false;
      delete d[id];
      return true;
    });
  }

  async leave(id: string, token: string) {
    return this.mutate((d) => {
      const r = d[id];
      const side = this.sideOf(r, token);
      if (!r || !side) return false;
      if (!r.confirmedAt || r.leftSide) {
        delete d[id];
        return true;
      }
      const dead = sha256(randomBytes(32).toString('hex'));
      d[id] = {
        ...r,
        leftSide: side,
        terms: { ...r.terms, [side]: { ...r.terms[side], name: '-' } },
        confirmedName: side === 'b' ? '-' : r.confirmedName,
        aHash: side === 'a' ? dead : r.aHash,
        bHash: side === 'b' ? dead : r.bHash,
        updatedAt: new Date().toISOString(),
      };
      return true;
    });
  }

  async purge() {
    const now = Date.now();
    await this.mutate((d) => {
      for (const [k, v] of Object.entries(d)) {
        if ((!v.confirmedAt && Date.parse(v.createdAt) < now - 30 * 86400000) || Date.parse(v.updatedAt) < now - 400 * 86400000) delete d[k];
      }
    });
  }
}

let store: SwapStore | null = null;

export function swapStore(): SwapStore {
  if (store) return store;
  const db = serviceClient();
  return (store = db ? new SupabaseSwaps(db) : new LocalSwaps());
}

/** Ids are short_id(): 10 characters of base64 without +/=. Anything else is a 404 without a query. */
export const validId = (id: string) => /^[A-Za-z0-9]{6,16}$/.test(id);

export async function loadSwap(id: string): Promise<SwapRecord | null> {
  if (!validId(id)) return null;
  return swapStore().get(id);
}

/**
 * Short code both players see once it's confirmed: the same terms and the same time give the
 * same code, on both phones and on the page. A screenshot with the code is the receipt.
 */
export function agreementCode(id: string, terms: SwapTerms, confirmedAt: string | null): string | null {
  if (!confirmedAt) return null;
  const t = terms;
  const canon = [id, t.scope, t.title, t.venue, t.currency, t.a.name, t.a.pct, t.b.name, t.b.pct, t.note, t.createdAt, Date.parse(confirmedAt)].join('|');
  const h = sha256(canon).slice(0, 8).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4)}`;
}

export function publicSwap(rec: SwapRecord, you: Side | null): PublicSwap {
  return { ...rec, code: agreementCode(rec.id, rec.terms, rec.confirmedAt), you };
}
