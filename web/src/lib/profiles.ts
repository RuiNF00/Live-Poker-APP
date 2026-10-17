import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStore } from './store';
import { serviceClient } from './supabase';
import { handleProblem, normalizeHandle, parseHandClaims, type ProfilePayload } from './profile-data';

export * from './profile-data';

// Public player profiles (/u/<handle>). Supabase in production (migration 20261017150000),
// a JSON file without it. Reports hide a profile for review; the owner's delete is final.

export interface ProfileRecord {
  handle: string;
  payload: ProfilePayload;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ReportResult = 'missing' | 'ok' | 'hidden';

export interface ProfileStore {
  /** The edit token, or null when the handle is taken. */
  create(handle: string, p: ProfilePayload): Promise<string | null>;
  get(handle: string): Promise<ProfileRecord | null>;
  isFree(handle: string): Promise<boolean>;
  /** False with a wrong token, or when `newHandle` is taken. */
  update(handle: string, editToken: string, p: ProfilePayload, newHandle?: string): Promise<boolean>;
  remove(handle: string, editToken: string): Promise<boolean>;
  recordView(handle: string): Promise<void>;
  /** Hidden for review after 3 distinct reporters; 'hidden' when this report did it. */
  report(handle: string, reporterId: string): Promise<ReportResult>;
  purge(): Promise<void>;
}

interface Row {
  handle: string;
  payload: ProfilePayload;
  view_count: number;
  created_at: string;
  updated_at: string;
}

class SupabaseProfiles implements ProfileStore {
  constructor(private db: SupabaseClient) {}

  async create(handle: string, p: ProfilePayload) {
    const { data, error } = await this.db.rpc('create_profile', { p_handle: handle, p_payload: p });
    if (error) throw error;
    return (data as string | null) ?? null;
  }

  async get(handle: string) {
    const { data, error } = await this.db.rpc('get_profile', { p_handle: handle });
    if (error) throw error;
    const r = (data as Row[] | null)?.[0];
    return r ? { handle: r.handle, payload: r.payload, viewCount: r.view_count, createdAt: r.created_at, updatedAt: r.updated_at } : null;
  }

  async isFree(handle: string) {
    const { data, error } = await this.db.rpc('profile_handle_free', { p_handle: handle });
    if (error) throw error;
    return !!data;
  }

  async update(handle: string, editToken: string, p: ProfilePayload, newHandle?: string) {
    const { data, error } = await this.db.rpc('update_profile', { p_handle: handle, p_edit_token: editToken, p_payload: p, p_new_handle: newHandle ?? null });
    if (error) throw error;
    return !!data;
  }

  async remove(handle: string, editToken: string) {
    const { data, error } = await this.db.rpc('delete_profile', { p_handle: handle, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async recordView(handle: string) {
    await this.db.rpc('record_profile_view', { p_handle: handle });
  }

  async report(handle: string, reporterId: string) {
    const { data, error } = await this.db.rpc('report_profile', { p_handle: handle, p_reporter_id: reporterId });
    if (error) throw error;
    return data as ReportResult;
  }

  async purge() {
    await this.db.rpc('purge_hidden_profiles');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
type LocalRow = ProfileRecord & { editTokenHash: string; hiddenAt: string | null; reporters: string[] };

class LocalProfiles implements ProfileStore {
  private file = path.join(process.cwd(), '.data', 'profiles.json');
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

  async create(handle: string, p: ProfilePayload) {
    const token = randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    return this.mutate((d) => {
      if (d[handle]) return null;
      d[handle] = { handle, payload: p, viewCount: 0, createdAt: now, updatedAt: now, editTokenHash: sha256(token), hiddenAt: null, reporters: [] };
      return token;
    });
  }

  async get(handle: string) {
    const r = (await this.read())[handle];
    if (!r || r.hiddenAt) return null;
    const { editTokenHash: _h, hiddenAt: _x, reporters: _r, ...rec } = r;
    return rec;
  }

  async isFree(handle: string) {
    return !(await this.read())[handle];
  }

  async update(handle: string, editToken: string, p: ProfilePayload, newHandle?: string) {
    return this.mutate((d) => {
      const r = d[handle];
      if (r?.editTokenHash !== sha256(editToken)) return false;
      const to = newHandle ?? handle;
      if (to !== handle && d[to]) return false;
      delete d[handle];
      d[to] = { ...r, handle: to, payload: p, updatedAt: new Date().toISOString() };
      return true;
    });
  }

  async remove(handle: string, editToken: string) {
    return this.mutate((d) => {
      if (d[handle]?.editTokenHash !== sha256(editToken)) return false;
      delete d[handle];
      return true;
    });
  }

  async recordView(handle: string) {
    await this.mutate((d) => {
      if (d[handle] && !d[handle].hiddenAt) d[handle].viewCount++;
    });
  }

  async report(handle: string, reporterId: string) {
    return this.mutate((d): ReportResult => {
      const r = d[handle];
      if (!r || r.hiddenAt) return 'missing';
      if (!r.reporters.includes(reporterId)) r.reporters.push(reporterId);
      if (r.reporters.length >= 3) {
        r.hiddenAt = new Date().toISOString();
        return 'hidden';
      }
      return 'ok';
    });
  }

  async purge() {
    const cutoff = Date.now() - 30 * 86400000;
    await this.mutate((d) => {
      for (const [k, v] of Object.entries(d)) if (v.hiddenAt && Date.parse(v.hiddenAt) < cutoff) delete d[k];
    });
  }
}

let store: ProfileStore | null = null;

export function profileStore(): ProfileStore {
  if (store) return store;
  const db = serviceClient();
  return (store = db ? new SupabaseProfiles(db) : new LocalProfiles());
}

export async function loadProfile(raw: string): Promise<ProfileRecord | null> {
  const handle = normalizeHandle(raw);
  if (handleProblem(handle) === 'invalid') return null;
  return profileStore().get(handle);
}

/** Only hands whose edit token checks out: nobody can put someone else's hand on their profile. */
export async function ownedHands(raw: unknown): Promise<string[]> {
  const claims = parseHandClaims(raw);
  const shares = getStore();
  const ok = await Promise.all(claims.map((c) => shares.ownsShare(c.id, c.token).catch(() => false)));
  return claims.filter((_, i) => ok[i]).map((c) => c.id);
}
