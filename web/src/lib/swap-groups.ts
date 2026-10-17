import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './supabase';
import { shortId } from './store';
import type { GroupEntry, GroupRecord, GroupTerms, PublicGroup } from './swap-group-terms';

export * from './swap-group-terms';

// Group swaps (/swap/g/<id>). Supabase in production (migration 20261017230000), a JSON file
// without it. The database enforces the rules: terms and names never change, each seat is
// claimed once with the group's invite, and each seat only adds or removes its own entries.

type NewEntry = Omit<GroupEntry, 'id' | 'seat' | 'at'>;

export interface GroupStore {
  /** `own`: the app's token and invite (64 hex each), so a repeated create returns the group it already made. */
  create(t: GroupTerms, names: string[], own?: { token: string; invite: string }): Promise<{ id: string; token: string; invite: string }>;
  get(id: string): Promise<GroupRecord | null>;
  seat(id: string, token: string): Promise<number | null>;
  /**
   * The seat's token, or null (wrong invite, seat taken or missing). `token`: the app's own
   * (64 hex), so a claim sent again after a lost answer gets the same seat back.
   */
  claim(id: string, invite: string, seat: number, token?: string): Promise<string | null>;
  addEntry(id: string, token: string, e: NewEntry): Promise<boolean>;
  removeEntry(id: string, token: string, entryId: string): Promise<boolean>;
  /** Seat 0 frees another seat with nothing in the accounts: open again, its token dead. */
  release(id: string, token: string, seat: number): Promise<boolean>;
  /** Seat 0 drops a seat nobody took (from 4 players up); the others keep their seat numbers. */
  removeSeat(id: string, token: string, seat: number): Promise<boolean>;
  /** Seat 0 deletes it for everyone; any other seat leaves (name "-", token dead). */
  leave(id: string, token: string): Promise<boolean>;
  /** The creator's RevenueCat id (seat 0 only; replaces the last one). Never in a read of the group. */
  setOwnerRc(id: string, token: string, rc: string): Promise<boolean>;
  ownerRc(id: string): Promise<string | null>;
  purge(): Promise<void>;
}

interface Row {
  id: string;
  terms: GroupTerms;
  seats: { seat: number; name: string; confirmedAt: string | null }[];
  entries: GroupEntry[];
  created_at: string;
  updated_at: string;
}

class SupabaseGroups implements GroupStore {
  constructor(private db: SupabaseClient) {}

  async create(t: GroupTerms, names: string[], own?: { token: string; invite: string }) {
    const { data, error } = await this.db.rpc('create_swap_group', { p_terms: t, p_names: names, p_token: own?.token ?? null, p_invite: own?.invite ?? null });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { id: row.id as string, token: row.token as string, invite: row.invite as string };
  }

  async get(id: string) {
    const { data, error } = await this.db.rpc('get_swap_group', { p_id: id });
    if (error) throw error;
    const r = (data as Row[] | null)?.[0];
    return r ? { id: r.id, terms: r.terms, seats: r.seats ?? [], entries: r.entries ?? [], createdAt: r.created_at, updatedAt: r.updated_at } : null;
  }

  async seat(id: string, token: string) {
    const { data, error } = await this.db.rpc('swap_group_seat', { p_id: id, p_token: token });
    if (error) throw error;
    return typeof data === 'number' ? data : null;
  }

  async claim(id: string, invite: string, seat: number, token?: string) {
    const { data, error } = await this.db.rpc('claim_swap_group_seat', { p_id: id, p_invite: invite, p_seat: seat, p_token: token ?? null });
    if (error) throw error;
    return typeof data === 'string' && data ? data : null;
  }

  async addEntry(id: string, token: string, e: NewEntry) {
    const { data, error } = await this.db.rpc('add_swap_group_entry', { p_id: id, p_token: token, p_entry: e });
    if (error) throw error;
    return !!data;
  }

  async removeEntry(id: string, token: string, entryId: string) {
    const { data, error } = await this.db.rpc('remove_swap_group_entry', { p_id: id, p_token: token, p_entry_id: entryId });
    if (error) throw error;
    return !!data;
  }

  async release(id: string, token: string, seat: number) {
    const { data, error } = await this.db.rpc('release_swap_group_seat', { p_id: id, p_token: token, p_seat: seat });
    if (error) throw error;
    return !!data;
  }

  async removeSeat(id: string, token: string, seat: number) {
    const { data, error } = await this.db.rpc('remove_swap_group_seat', { p_id: id, p_token: token, p_seat: seat });
    if (error) throw error;
    return !!data;
  }

  async leave(id: string, token: string) {
    const { data, error } = await this.db.rpc('leave_swap_group', { p_id: id, p_token: token });
    if (error) throw error;
    return !!data;
  }

  async setOwnerRc(id: string, token: string, rc: string) {
    const { data, error } = await this.db.rpc('set_swap_group_owner_rc', { p_id: id, p_token: token, p_rc: rc });
    if (error) throw error;
    return !!data;
  }

  async ownerRc(id: string) {
    const { data, error } = await this.db.rpc('swap_group_owner_rc_of', { p_id: id });
    if (error) throw error;
    return typeof data === 'string' && data ? data : null;
  }

  async purge() {
    await this.db.rpc('purge_swap_groups');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
// `dropped`: seats removed before anyone took them (kept in the arrays so indexes stay seat numbers).
type LocalRow = GroupRecord & { inviteHash: string; hashes: (string | null)[]; ownerRc?: string; dropped?: number[] };

class LocalGroups implements GroupStore {
  private file = path.join(process.cwd(), '.data', 'swap-groups.json');
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

  private seatOf(r: LocalRow | undefined, token: string): number | null {
    if (!r || !token) return null;
    const i = r.hashes.indexOf(sha256(token));
    return i < 0 ? null : i;
  }

  async create(terms: GroupTerms, names: string[], own?: { token: string; invite: string }) {
    const token = own?.token ?? randomBytes(32).toString('hex');
    const invite = own?.invite ?? randomBytes(32).toString('hex');
    const again = Object.values(await this.read()).find((g) => g.hashes[0] === sha256(token) && g.inviteHash === sha256(invite));
    if (again) return { id: again.id, token, invite };
    const id = shortId();
    const now = new Date().toISOString();
    await this.mutate((d) => {
      d[id] = {
        id, terms, entries: [], createdAt: now, updatedAt: now, inviteHash: sha256(invite),
        seats: names.map((name, seat) => ({ seat, name, confirmedAt: seat === 0 ? now : null })),
        hashes: names.map((_, i) => (i === 0 ? sha256(token) : null)),
      };
    });
    return { id, token, invite };
  }

  async get(id: string) {
    const r = (await this.read())[id];
    if (!r) return null;
    const { inviteHash: _i, hashes: _h, ownerRc: _o, dropped, ...rec } = r;
    return { ...rec, seats: rec.seats.filter((s) => !dropped?.includes(s.seat)) };
  }

  async seat(id: string, token: string) {
    return this.seatOf((await this.read())[id], token);
  }

  async claim(id: string, invite: string, seat: number, own?: string) {
    return this.mutate((d) => {
      const r = d[id];
      if (!r || !invite || r.inviteHash !== sha256(invite)) return null;
      const s = r.seats[seat];
      if (!s || r.dropped?.includes(seat)) return null;
      // Already taken with this same token: the answer of the first time was lost.
      if (s.confirmedAt) return own && r.hashes[seat] === sha256(own) ? own : null;
      const token = own ?? randomBytes(32).toString('hex');
      if (r.hashes.some((h, i) => i !== seat && h === sha256(token))) return null;
      const now = new Date().toISOString();
      r.hashes[seat] = sha256(token);
      r.seats[seat] = { ...s, confirmedAt: now };
      r.updatedAt = now;
      return token;
    });
  }

  async addEntry(id: string, token: string, e: NewEntry) {
    return this.mutate((d) => {
      const r = d[id];
      const seat = this.seatOf(r, token);
      if (!r || seat === null || r.seats.some((s) => !s.confirmedAt && !r.dropped?.includes(s.seat))) return false;
      if (e.kind === 'payment' && (e.to === seat || !r.seats[e.to ?? -1] || r.dropped?.includes(e.to ?? -1))) return false;
      if (r.entries.some((x) => x.seat === seat && x.cid === e.cid)) return true;
      r.entries.push({ ...e, id: randomBytes(6).toString('hex'), seat, at: Date.now() });
      r.updatedAt = new Date().toISOString();
      return true;
    });
  }

  async removeEntry(id: string, token: string, entryId: string) {
    return this.mutate((d) => {
      const r = d[id];
      const seat = this.seatOf(r, token);
      if (!r || seat === null) return false;
      const n = r.entries.length;
      r.entries = r.entries.filter((x) => !(x.id === entryId && x.seat === seat));
      r.updatedAt = new Date().toISOString();
      return r.entries.length < n;
    });
  }

  async release(id: string, token: string, seat: number) {
    return this.mutate((d) => {
      const r = d[id];
      if (this.seatOf(r, token) !== 0 || seat < 1 || !r.seats[seat]?.confirmedAt) return false;
      if (r.entries.some((e) => e.seat === seat || e.to === seat)) return false;
      r.seats[seat] = { ...r.seats[seat], confirmedAt: null };
      r.hashes[seat] = null;
      r.updatedAt = new Date().toISOString();
      return true;
    });
  }

  async removeSeat(id: string, token: string, seat: number) {
    return this.mutate((d) => {
      const r = d[id];
      if (this.seatOf(r, token) !== 0 || seat < 1 || !r.seats[seat] || r.seats[seat].confirmedAt || r.dropped?.includes(seat)) return false;
      if (r.seats.length - (r.dropped?.length ?? 0) <= 3) return false;
      r.dropped = [...(r.dropped ?? []), seat];
      r.updatedAt = new Date().toISOString();
      return true;
    });
  }

  async leave(id: string, token: string) {
    return this.mutate((d) => {
      const r = d[id];
      const seat = this.seatOf(r, token);
      if (!r || seat === null) return false;
      if (seat === 0) delete d[id];
      else {
        r.seats[seat] = { ...r.seats[seat], name: '-' };
        r.hashes[seat] = sha256(randomBytes(32).toString('hex'));
        r.updatedAt = new Date().toISOString();
      }
      return true;
    });
  }

  async setOwnerRc(id: string, token: string, rc: string) {
    return this.mutate((d) => {
      const r = d[id];
      if (this.seatOf(r, token) !== 0 || !rc || rc.length > 100) return false;
      r.ownerRc = rc;
      return true;
    });
  }

  async ownerRc(id: string) {
    return (await this.read())[id]?.ownerRc ?? null;
  }

  async purge() {
    const now = Date.now();
    await this.mutate((d) => {
      for (const [k, v] of Object.entries(d)) {
        const open = v.seats.some((s) => !s.confirmedAt);
        if ((open && Date.parse(v.createdAt) < now - 30 * 86400000) || Date.parse(v.updatedAt) < now - 400 * 86400000) delete d[k];
      }
    });
  }
}

let store: GroupStore | null = null;

export function groupStore(): GroupStore {
  if (store) return store;
  const db = serviceClient();
  return (store = db ? new SupabaseGroups(db) : new LocalGroups());
}

export async function loadGroup(id: string): Promise<GroupRecord | null> {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return null;
  return groupStore().get(id);
}

export const publicGroup = (rec: GroupRecord, you: number | null): PublicGroup => ({ ...rec, you });
