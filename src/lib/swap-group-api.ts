// Client for group swaps on sweatbook.poker (web/src/app/api/swap-groups). The creator gets
// seat 0's token and the group's invite; each other player claims their seat with the invite.

import { variant } from '@/i18n';
import type { GroupEntry, GroupTerms, RemoteGroup } from '@/store/swap-groups';
import { BRAND } from '@/theme';

import { withLang } from './link-lang';
import { SwapError } from './swap-api';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

/** The link for the group chat: the invite rides in the fragment, never in a server log. */
export function groupUrl(id: string, invite: string, ref?: string): string {
  return withLang(`${BRAND.webUrl}/swap/g/${id}${ref ? `?r=${encodeURIComponent(ref)}` : ''}#i=${invite}`, variant);
}

type Reply = { group?: RemoteGroup; token?: string; invite?: string; id?: string; accounts?: boolean };

async function call(path: string, init: RequestInit & { token?: string } = {}): Promise<Reply> {
  const { token, ...rest } = init;
  const res = await fetch(`${API}/api/swap-groups${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', ...(token ? { 'x-edit-token': token } : {}) },
  });
  const j = (await res.json().catch(() => ({}))) as Reply & { error?: string };
  if (!res.ok) throw new SwapError(j.error ?? 'http_' + res.status, res.status);
  if (j.group && typeof j.accounts === 'boolean') j.group = { ...j.group, accounts: j.accounts };
  return j;
}

/** `rcUserId`: my RevenueCat id, so the group's accounts follow my Pro for everyone in it. */
/** `keys`: the draft's token and invite (newCreateKey), so a retry gets the same group back. */
export async function createGroup(terms: GroupTerms, names: string[], rcUserId?: string, keys?: { token: string; invite: string }): Promise<{ group: RemoteGroup; token: string; invite: string }> {
  const j = await call('', { method: 'POST', body: JSON.stringify({ terms, names, rcUserId, ...keys }) });
  if (!j.group || !j.token || !j.invite) throw new SwapError('bad_response', 500);
  return { group: j.group, token: j.token, invite: j.invite };
}

/** Null when it no longer exists. */
export async function fetchGroup(id: string, token?: string): Promise<RemoteGroup | null> {
  try {
    return (await call(`/${encodeURIComponent(id)}`, { token })).group ?? null;
  } catch (e) {
    if (e instanceof SwapError && e.status === 404) return null;
    throw e;
  }
}

export async function claimSeat(id: string, invite: string, seat: number): Promise<{ group: RemoteGroup; token: string }> {
  const j = await call(`/${encodeURIComponent(id)}/claim`, { method: 'POST', body: JSON.stringify({ seat, invite }) });
  if (!j.group || !j.token) throw new SwapError('bad_response', 500);
  return { group: j.group, token: j.token };
}

export async function addGroupEntry(id: string, token: string, e: Pick<GroupEntry, 'cid' | 'kind' | 'amount' | 'event' | 'finish' | 'to'>): Promise<RemoteGroup> {
  const j = await call(`/${encodeURIComponent(id)}/entries`, { method: 'POST', token, body: JSON.stringify({ entry: e }) });
  if (!j.group) throw new SwapError('bad_response', 500);
  return j.group;
}

export async function removeGroupEntry(id: string, token: string, entryId: string): Promise<RemoteGroup> {
  const j = await call(`/${encodeURIComponent(id)}/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE', token });
  if (!j.group) throw new SwapError('bad_response', 500);
  return j.group;
}

/** The creator's RevenueCat id changed (a reinstall or a restore): the new one replaces it. */
export async function setGroupOwnerRc(id: string, token: string, rcUserId: string): Promise<void> {
  await call(`/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: JSON.stringify({ rcUserId }) });
}

/** The creator takes out a player with nothing in the accounts: their seat is open again. */
export async function releaseSeat(id: string, token: string, seat: number): Promise<RemoteGroup> {
  const j = await call(`/${encodeURIComponent(id)}/seats/${seat}`, { method: 'DELETE', token });
  if (!j.group) throw new SwapError('bad_response', 500);
  return j.group;
}

/** The creator deletes it for everyone; anyone else leaves it. A missing group counts as done. */
export async function leaveGroup(id: string, token: string): Promise<void> {
  try {
    await call(`/${encodeURIComponent(id)}`, { method: 'DELETE', token });
  } catch (e) {
    if (!(e instanceof SwapError && e.status === 404)) throw e;
  }
}
