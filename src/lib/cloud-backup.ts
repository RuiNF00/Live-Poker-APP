// Cloud backup without an account: a random recovery code (id + secret) the
// user keeps. The server only stores sha256(secret), so the code is the key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { BackupData } from '@/store/backup';
import { parseBackup } from '@/store/backup';
import { BRAND } from '@/theme';

import { deriveKeys, seal, unseal } from './backup-crypto';
import { ALPHA, type CloudState } from './cloud-code';

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

export async function upload(c: CloudState, data: BackupData): Promise<CloudState> {
  const { auth, enc } = deriveKeys(c.secret);
  const res = await fetch(`${API}/api/backup/${c.id}`, {
    method: 'PUT',
    // Encrypted on the phone; the server only ever sees a key derived from the code.
    headers: { 'content-type': 'application/json', 'x-backup-key': auth },
    body: seal(JSON.stringify(data), enc, Crypto.getRandomBytes(12)),
  });
  if (res.status === 413) throw new Error('too_big');
  if (res.status === 507) throw new Error('quota');
  if (res.status === 503) throw new Error('disabled');
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : 'network');
  const next = { ...c, lastAt: Date.now() };
  await saveCloud(next);
  return next;
}

export async function download(c: CloudState): Promise<BackupData> {
  const { auth, enc } = deriveKeys(c.secret);
  const res = await fetch(`${API}/api/backup/${c.id}`, { headers: { 'x-backup-key': auth } });
  if (res.status === 404) throw new Error('not_found');
  if (res.status === 503) throw new Error('disabled');
  if (!res.ok) throw new Error('network');
  return parseBackup(unseal(new Uint8Array(await res.arrayBuffer()), enc));
}

export async function removeRemote(c: CloudState): Promise<void> {
  const res = await fetch(`${API}/api/backup/${c.id}`, { method: 'DELETE', headers: { 'x-backup-key': deriveKeys(c.secret).auth } }).catch(() => null);
  // 404: already gone. Anything else means the copy may still be on the server.
  if (!res || (!res.ok && res.status !== 404)) throw new Error(res?.status === 403 ? 'forbidden' : 'network');
}
