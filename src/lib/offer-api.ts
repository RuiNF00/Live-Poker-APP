// Client for festival action offers (web/src/app/api/offers). The link is public;
// the token the server returns at creation lets this phone change the offer and
// see who reserved (names never reach the public page).

import type { OfferPayload, Reservation, ReservationStatus } from '@/store/action-offer';
import { BRAND } from '@/theme';

// Same server as share-api.ts (not imported from there: it pulls in native modules).
const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

export type OfferError = 'offensive' | 'conflict' | 'gone' | 'rate_limited' | 'network';

async function call(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API}${path}`, init);
  } catch {
    throw new OfferFailure('network');
  }
}

export class OfferFailure extends Error {
  constructor(public reason: OfferError) {
    super('offer ' + reason);
  }
}

const fail = (status: number): never => {
  throw new OfferFailure(status === 422 ? 'offensive' : status === 409 ? 'conflict' : status === 404 || status === 403 ? 'gone' : status === 429 ? 'rate_limited' : 'network');
};

export async function publishOffer(offer: OfferPayload): Promise<{ id: string; token: string; url: string }> {
  const res = await call('/api/offers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offer }) });
  if (!res.ok) fail(res.status);
  const j = await res.json();
  return { id: j.id, token: j.token, url: j.url };
}

export async function updateRemoteOffer(remote: { id: string; token: string }, offer: OfferPayload): Promise<void> {
  const res = await call(`/api/offers/${encodeURIComponent(remote.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-edit-token': remote.token },
    body: JSON.stringify({ offer }),
  });
  if (!res.ok) fail(res.status);
}

export async function deleteRemoteOffer(remote: { id: string; token: string }): Promise<void> {
  await call(`/api/offers/${encodeURIComponent(remote.id)}`, { method: 'DELETE', headers: { 'x-edit-token': remote.token } }).catch(() => {});
}

/** The reservations, with names: only the owner (token) gets them. */
export async function fetchReservations(remote: { id: string; token: string }): Promise<Reservation[]> {
  const res = await call(`/api/offers/${encodeURIComponent(remote.id)}`, { headers: { 'x-edit-token': remote.token } });
  if (!res.ok) fail(res.status);
  const j = (await res.json()) as { reservations?: unknown };
  return Array.isArray(j.reservations) ? j.reservations.map(toReservation).filter((x): x is Reservation => !!x) : [];
}

export async function setReservationStatus(remote: { id: string; token: string }, rid: string, status: ReservationStatus): Promise<void> {
  const res = await call(`/api/offers/${encodeURIComponent(remote.id)}/reservations/${encodeURIComponent(rid)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-edit-token': remote.token },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) fail(res.status);
}

const STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'declined'];

function toReservation(x: unknown): Reservation | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const shares = Array.isArray(o.shares)
    ? o.shares
        .map((s) => (s && typeof s === 'object' ? { e: String((s as { e?: unknown }).e ?? ''), p: Number((s as { p?: unknown }).p) } : null))
        .filter((s): s is { e: string; p: number } => !!s && !!s.e && Number.isFinite(s.p) && s.p > 0 && s.p <= 100)
    : [];
  const status = STATUSES.includes(o.status as ReservationStatus) ? (o.status as ReservationStatus) : null;
  if (typeof o.id !== 'string' || !status || !shares.length) return null;
  return {
    id: o.id,
    name: typeof o.name === 'string' ? o.name.slice(0, 40) : '',
    contact: typeof o.contact === 'string' && o.contact ? o.contact.slice(0, 60) : undefined,
    shares,
    status,
    createdAt: typeof o.created_at === 'string' ? o.created_at : typeof o.createdAt === 'string' ? o.createdAt : '',
  };
}
