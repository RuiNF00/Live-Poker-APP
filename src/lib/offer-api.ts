// Client for the private agreement links of festival packages (web/src/app/api/offers).
// One link per backer; the token the server returns at creation lets this phone
// change or remove it. The backer can only confirm the piece already agreed.

import type { AgreementPayload } from '@/store/action-offer';
import { BRAND } from '@/theme';

import { outcomeOf, queue, queued, registerSender } from './sync';

// Same server as share-api.ts (not imported from there: it pulls in native modules).
const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

export type OfferError = 'offensive' | 'gone' | 'rate_limited' | 'network';

export class OfferFailure extends Error {
  constructor(public reason: OfferError) {
    super('offer ' + reason);
  }
}

async function call(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, init);
  } catch {
    throw new OfferFailure('network');
  }
  if (!res.ok) throw new OfferFailure(res.status === 422 ? 'offensive' : res.status === 404 || res.status === 403 ? 'gone' : res.status === 429 ? 'rate_limited' : 'network');
  return res;
}

export async function publishAgreement(offer: AgreementPayload): Promise<{ id: string; token: string; url: string }> {
  const j = await (await call('/api/offers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offer }) })).json();
  return { id: j.id, token: j.token, url: j.url };
}

/** New terms: the server clears the backer's confirmation when markup or events change. */
export async function updateAgreement(remote: { id: string; token: string }, offer: AgreementPayload): Promise<void> {
  await call(`/api/offers/${encodeURIComponent(remote.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-edit-token': remote.token },
    body: JSON.stringify({ offer }),
  });
}

/**
 * New terms go out now or when the signal is back: until they reach the server, the link still has
 * the old ones (and their confirmation), so the screen doesn't read a confirmation while one waits.
 * A newer change replaces one still waiting.
 */
export function queueAgreementUpdate(remote: { id: string; token: string }, offer: AgreementPayload) {
  queue('offer-update', { id: remote.id, token: remote.token, offer }, remote.id);
}

/** New terms for this link still waiting to go out. */
export function agreementUpdateWaiting(id: string): Promise<boolean> {
  return queued('offer-update', id);
}

registerSender('offer-update', async (p) => {
  const r = p as { id: string; token: string; offer: AgreementPayload };
  try {
    const res = await fetch(`${API}/api/offers/${encodeURIComponent(r.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-edit-token': r.token },
      body: JSON.stringify({ offer: r.offer }),
    });
    return outcomeOf(res.status);
  } catch {
    return 'retry';
  }
});

/** When the backer confirmed (ISO), or null. */
export async function fetchConfirmation(remote: { id: string }): Promise<string | null> {
  const j = (await (await call(`/api/offers/${encodeURIComponent(remote.id)}`, { cache: 'no-store' })).json()) as { confirmedAt?: unknown };
  return typeof j.confirmedAt === 'string' ? j.confirmedAt : null;
}

/** Removes the link now or when the signal is back (deleting a package, erasing all data). */
export function queueAgreementDelete(remote: { id: string; token: string }) {
  queue('offer-delete', remote, remote.id);
}

registerSender('offer-delete', async (p) => {
  const r = p as { id: string; token: string };
  try {
    const res = await fetch(`${API}/api/offers/${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { 'x-edit-token': r.token } });
    return outcomeOf(res.status);
  } catch {
    return 'retry';
  }
});
