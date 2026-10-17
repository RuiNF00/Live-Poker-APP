// Client for public profiles (web/src/app/api/profiles). Off until the player creates one;
// the edit token stays on this phone, so only this phone can change or delete the profile.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { BRAND } from '@/theme';

import type { ProfileDraft, ProfileLink } from './profile-payload';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'pp.link.v1';

export type HandleCheck = 'ok' | 'taken' | 'invalid' | 'reserved' | 'offensive' | 'offline';
/** ok, or why the server said no. */
export type SaveResult = 'ok' | 'taken' | 'invalid' | 'reserved' | 'offensive' | 'gone' | 'offline' | 'error';

type Body = { profile: unknown; hands: { id: string; token: string }[] };

export function profileUrl(handle: string) {
  return `${BRAND.webUrl}/u/${handle}`;
}

export async function loadProfileLink(): Promise<ProfileLink | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? (JSON.parse(v) as ProfileLink) : null;
  } catch {
    return null;
  }
}

async function keep(link: ProfileLink | null) {
  if (link) await AsyncStorage.setItem(KEY, JSON.stringify(link));
  else await AsyncStorage.removeItem(KEY);
}

export async function checkHandle(handle: string): Promise<HandleCheck> {
  try {
    const r = await fetch(`${API}/api/profiles/check?handle=${encodeURIComponent(handle)}`);
    const j = (await r.json()) as { ok?: boolean; problem?: HandleCheck };
    return j.ok ? 'ok' : (j.problem ?? 'invalid');
  } catch {
    return 'offline';
  }
}

function fromError(status: number, error?: string): SaveResult {
  if (status === 409) return 'taken';
  if (status === 404) return 'gone';
  if (error === 'offensive') return 'offensive';
  if (error === 'handle_reserved') return 'reserved';
  if (error === 'handle_offensive') return 'offensive';
  if (status === 422) return 'invalid';
  return 'error';
}

export async function createProfile(handle: string, draft: ProfileDraft, body: Body): Promise<SaveResult> {
  try {
    const r = await fetch(`${API}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle, ...body }),
    });
    const j = (await r.json().catch(() => ({}))) as { handle?: string; token?: string; error?: string };
    if (!r.ok || !j.token || !j.handle) return fromError(r.status, j.error);
    await keep({ handle: j.handle, token: j.token, draft, savedAt: Date.now() });
    return 'ok';
  } catch {
    return 'offline';
  }
}

/** Saves the picked hands, sessions and text; `newHandle` changes the link (the old one stops working). */
export async function updateProfile(link: ProfileLink, draft: ProfileDraft, body: Body, newHandle?: string): Promise<SaveResult> {
  try {
    const r = await fetch(`${API}/api/profiles/${encodeURIComponent(link.handle)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-edit-token': link.token },
      body: JSON.stringify({ ...body, ...(newHandle && newHandle !== link.handle ? { newHandle } : {}) }),
    });
    const j = (await r.json().catch(() => ({}))) as { handle?: string; error?: string };
    if (!r.ok) {
      // Deleted elsewhere or removed after review: forget it so the player can start again.
      if (r.status === 404) await keep(null);
      return fromError(r.status, j.error);
    }
    await keep({ ...link, handle: j.handle ?? newHandle ?? link.handle, draft, savedAt: Date.now() });
    return 'ok';
  } catch {
    return 'offline';
  }
}

/** Takes the page down for good. */
export async function deleteProfile(link: ProfileLink): Promise<SaveResult> {
  try {
    const r = await fetch(`${API}/api/profiles/${encodeURIComponent(link.handle)}`, {
      method: 'DELETE',
      headers: { 'x-edit-token': link.token },
    });
    if (!r.ok && r.status !== 404) return 'error';
    await keep(null);
    return 'ok';
  } catch {
    return 'offline';
  }
}
