import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './supabase';
import { shortId } from './store';
import {
  reserveCheck,
  sumTaken,
  updateConflicts,
  type Offer,
  type ReservationIn,
  type ReservationStatus,
  type ReserveError,
  type Share,
} from './offer';

export * from './offer';

// Festival action packages (/o/<id>). Supabase in production (migration 20261017140000),
// where reserve_action() checks cap and what is left under a row lock on the offer; a
// JSON file without it, where the same checks run inside one queued read-modify-write.

/** What anyone with the link may see: no names, no contacts, no single reservation. */
export interface OfferRecord {
  id: string;
  offer: Offer;
  /** % held per event by pending and confirmed reservations. */
  taken: Record<string, number>;
  /** Active (pending + confirmed) reservations. */
  count: number;
  createdAt: string;
  updatedAt: string;
}

/** Only for the player (edit token). */
export interface ReservationRecord {
  id: string;
  name: string;
  contact: string;
  shares: Share[];
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReserveResult = { rid: string } | { error: ReserveError };
export type UpdateResult = 'ok' | 'not_found' | 'conflict';
export type StatusResult = 'ok' | 'not_found' | 'invalid' | 'sold_out';

export interface OffersStore {
  create(o: Offer): Promise<{ id: string; editToken: string }>;
  get(id: string): Promise<OfferRecord | null>;
  /** 'not_found' with a wrong token; 'conflict' when an event would offer less than is taken. */
  update(id: string, editToken: string, o: Offer): Promise<UpdateResult>;
  remove(id: string, editToken: string): Promise<boolean>;
  /** null with a wrong token or a gone offer. */
  reservations(id: string, editToken: string): Promise<ReservationRecord[] | null>;
  /** Atomic: checks closed, cap, min, whole and what is left, then holds the %. */
  reserve(id: string, r: ReservationIn): Promise<ReserveResult>;
  setStatus(id: string, editToken: string, rid: string, status: ReservationStatus): Promise<StatusResult>;
  /** Removes offers 60 days after their last event. */
  purge(): Promise<void>;
}

const RESERVE_ERRORS: ReserveError[] = ['not_found', 'closed', 'invalid', 'over_cap', 'sold_out', 'full'];

const toNumbers = (x: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) out[k] = Math.round(Number(v) * 100) / 100;
  return out;
};

class SupabaseOffers implements OffersStore {
  constructor(private db: SupabaseClient) {}

  async create(o: Offer) {
    const { data, error } = await this.db.rpc('create_action_offer', { p_payload: o });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { id: row.id as string, editToken: row.edit_token as string };
  }

  async get(id: string) {
    const { data, error } = await this.db.rpc('get_action_offer', { p_id: id });
    if (error) throw error;
    const r = (data as { id: string; payload: Offer; taken: unknown; count: number; created_at: string; updated_at: string }[] | null)?.[0];
    return r ? { id: r.id, offer: r.payload, taken: toNumbers(r.taken), count: r.count, createdAt: r.created_at, updatedAt: r.updated_at } : null;
  }

  async update(id: string, editToken: string, o: Offer) {
    const { data, error } = await this.db.rpc('update_action_offer', { p_id: id, p_edit_token: editToken, p_payload: o });
    if (error) throw error;
    return data === 'ok' || data === 'conflict' ? data : 'not_found';
  }

  async remove(id: string, editToken: string) {
    const { data, error } = await this.db.rpc('delete_action_offer', { p_id: id, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async reservations(id: string, editToken: string) {
    const { data, error } = await this.db.rpc('list_action_reservations', { p_id: id, p_edit_token: editToken });
    if (error) throw error;
    if (!Array.isArray(data)) return null;
    return (data as { id: string; name: string; contact: string; shares: Share[]; status: ReservationStatus; created_at: string; updated_at: string }[]).map((r) => ({
      id: r.id,
      name: r.name,
      contact: r.contact,
      shares: r.shares,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async reserve(id: string, r: ReservationIn): Promise<ReserveResult> {
    const { data, error } = await this.db.rpc('reserve_action', { p_offer_id: id, p_name: r.name, p_contact: r.contact, p_shares: r.shares });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { rid: string | null; result: string } | null;
    if (row?.rid && row.result === 'ok') return { rid: row.rid };
    const why = RESERVE_ERRORS.find((e) => e === row?.result) ?? 'invalid';
    return { error: why };
  }

  async setStatus(id: string, editToken: string, rid: string, status: ReservationStatus) {
    const { data, error } = await this.db.rpc('set_reservation_status', { p_id: id, p_edit_token: editToken, p_rid: rid, p_status: status });
    if (error) throw error;
    return data === 'ok' || data === 'invalid' || data === 'sold_out' ? data : 'not_found';
  }

  async purge() {
    await this.db.rpc('purge_action_offers');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

interface LocalOffer {
  id: string;
  offer: Offer;
  editTokenHash: string;
  reservations: ReservationRecord[];
  createdAt: string;
  updatedAt: string;
}

const lastEvent = (o: Offer) => Math.max(...o.events.map((e) => e.d));

/**
 * The same semantics as the SQL, in a JSON file (.data/offers.json by default). Every
 * write goes through one promise queue, so a reservation's check and its insert happen in
 * one step, as under the row lock in Postgres.
 */
export class LocalOffers implements OffersStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file = path.join(process.cwd(), '.data', 'offers.json')) {}

  private async read(): Promise<Record<string, LocalOffer>> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch {
      return {};
    }
  }

  private async mutate<T>(fn: (d: Record<string, LocalOffer>) => T): Promise<T> {
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

  private owned(d: Record<string, LocalOffer>, id: string, editToken: string) {
    const r = d[id];
    return r && r.editTokenHash === sha256(editToken) ? r : null;
  }

  async create(o: Offer) {
    const id = shortId();
    const editToken = randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    await this.mutate((d) => {
      d[id] = { id, offer: o, editTokenHash: sha256(editToken), reservations: [], createdAt: now, updatedAt: now };
    });
    return { id, editToken };
  }

  async get(id: string) {
    // Reads wait for queued writes, so a page loaded right after a reservation sees it.
    await this.queue;
    const r = (await this.read())[id];
    if (!r) return null;
    const active = r.reservations.filter((x) => x.status !== 'declined');
    return { id: r.id, offer: r.offer, taken: sumTaken(active), count: active.length, createdAt: r.createdAt, updatedAt: r.updatedAt };
  }

  async update(id: string, editToken: string, o: Offer) {
    return this.mutate((d): UpdateResult => {
      const r = this.owned(d, id, editToken);
      if (!r) return 'not_found';
      if (updateConflicts(o, sumTaken(r.reservations)).length) return 'conflict';
      r.offer = o;
      r.updatedAt = new Date().toISOString();
      return 'ok';
    });
  }

  async remove(id: string, editToken: string) {
    return this.mutate((d) => {
      if (!this.owned(d, id, editToken)) return false;
      delete d[id];
      return true;
    });
  }

  async reservations(id: string, editToken: string) {
    await this.queue;
    const r = this.owned(await this.read(), id, editToken);
    return r ? r.reservations.map((x) => ({ ...x })) : null;
  }

  async reserve(id: string, input: ReservationIn) {
    return this.mutate((d): ReserveResult => {
      const r = d[id];
      if (!r) return { error: 'not_found' };
      const why = reserveCheck(r.offer, sumTaken(r.reservations), input, r.reservations.length);
      if (why) return { error: why };
      let rid = shortId();
      while (r.reservations.some((x) => x.id === rid)) rid = shortId();
      const now = new Date().toISOString();
      r.reservations.push({ id: rid, name: input.name, contact: input.contact, shares: input.shares, status: 'pending', createdAt: now, updatedAt: now });
      r.updatedAt = now;
      return { rid };
    });
  }

  async setStatus(id: string, editToken: string, rid: string, status: ReservationStatus) {
    return this.mutate((d): StatusResult => {
      if (!['pending', 'confirmed', 'declined'].includes(status)) return 'invalid';
      const r = this.owned(d, id, editToken);
      const res = r?.reservations.find((x) => x.id === rid);
      if (!r || !res) return 'not_found';
      if (res.status === 'declined' && status !== 'declined') {
        const others = r.reservations.filter((x) => x.id !== rid);
        const left = sumTaken(others);
        if (res.shares.some((s) => (left[s.e] ?? 0) + s.p > (r.offer.events.find((e) => e.id === s.e)?.s ?? 0) + 1e-9)) return 'sold_out';
      }
      const now = new Date().toISOString();
      res.status = status;
      res.updatedAt = now;
      r.updatedAt = now;
      return 'ok';
    });
  }

  async purge() {
    const cutoff = Date.now() - 60 * 86400000;
    await this.mutate((d) => {
      for (const [k, v] of Object.entries(d)) if (lastEvent(v.offer) < cutoff) delete d[k];
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
