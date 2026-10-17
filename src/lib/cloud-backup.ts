// Cloud backup without an account: a random recovery code (id + secret) the
// user keeps. The server only stores sha256(secret), so the code is the key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { BackupData } from '@/store/backup';
import { parseBackup } from '@/store/backup';
import { BRAND } from '@/theme';

import { deriveKeys, sealAsync, unseal } from './backup-crypto';
import { ALPHA, type CloudState } from './cloud-code';
import { countsOf, uploadBlock } from './cloud-guard';
import { longSignal } from './net';
import { outcomeOf, queue, registerSender } from './sync';

export { formatCode, parseCode, type CloudState } from './cloud-code';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'rl.cloud.v1';


function randomB32(n: number): string {
  const bytes = Crypto.getRandomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHA[bytes[i] & 31];
  return out;
}

export async function loadCloud(): Promise<CloudState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CloudState) : null;
  } catch {
    return null;
  }
}

export async function saveCloud(c: CloudState | null): Promise<void> {
  if (c) await AsyncStorage.setItem(KEY, JSON.stringify(c));
  else await AsyncStorage.removeItem(KEY);
}

export function newCloud(): CloudState {
  return { id: randomB32(10), secret: randomB32(16) };
}

/**
 * Replaces the server copy. Refuses ('would_shrink') when this phone is empty
 * or has less than half of the copy it would replace, unless force (a brand-new code, or the user
 * confirmed they deleted things on purpose).
 */
export async function upload(c: CloudState, data: BackupData, opts: { force?: boolean } = {}): Promise<CloudState> {
  const block = uploadBlock(countsOf(data), c, opts.force);
  if (block) throw new Error(block);
  const { auth, enc } = deriveKeys(c.secret);
  const body = await sealAsync(JSON.stringify(data), enc, Crypto.getRandomBytes(12));
  const res = await fetch(`${API}/api/backup/${c.id}`, {
    method: 'PUT',
    // Encrypted on the phone; the server only ever sees a key derived from the code.
    headers: { 'content-type': 'application/json', 'x-backup-key': auth },
    body,
    signal: longSignal(),
  });
  if (res.status === 413) throw new Error('too_big');
  if (res.status === 507) throw new Error('quota');
  if (res.status === 503) throw new Error('disabled');
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : 'network');
  const next: CloudState = { ...c, lastAt: Date.now(), counts: countsOf(data) };
  // A restore with another code may have finished while this was uploading;
  // don't put the old code back.
  const now = await loadCloud();
  if (!now || now.id === c.id) await saveCloud(next);
  return next;
}

export async function download(c: CloudState): Promise<BackupData> {
  const { auth, enc } = deriveKeys(c.secret);
  const res = await fetch(`${API}/api/backup/${c.id}`, { headers: { 'x-backup-key': auth }, signal: longSignal() });
  if (res.status === 404) throw new Error('not_found');
  if (res.status === 503) throw new Error('disabled');
  if (!res.ok) throw new Error('network');
  return parseBackup(unseal(new Uint8Array(await res.arrayBuffer()), enc));
}

export async function removeRemote(c: CloudState): Promise<void> {
  const res = await fetch(`${API}/api/backup/${c.id}`, { method: 'DELETE', headers: { 'x-backup-key': deriveKeys(c.secret).auth } }).catch(() => null);
  // 404: already gone. Anything else means the copy may still be on the server.
  if (!res || (!res.ok && res.status !== 404)) throw new Error(res?.status === 403 ? 'forbidden' : res?.status === 503 ? 'disabled' : 'network');
}

/**
 * Deletes the server copy now or when the signal is back. Only the derived key goes in
 * the queue: it can delete the copy but not read it.
 */
export function queueCloudDelete(c: CloudState) {
  queue('cloud-delete', { id: c.id, auth: deriveKeys(c.secret).auth }, c.id);
}

registerSender('cloud-delete', async (p) => {
  const { id, auth } = p as { id: string; auth: string };
  const res = await fetch(`${API}/api/backup/${id}`, { method: 'DELETE', headers: { 'x-backup-key': auth } }).catch(() => null);
  if (!res) return 'retry';
  return res.status === 404 ? 'done' : outcomeOf(res.status);
});
