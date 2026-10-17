// Cloud backup without an account: a random recovery code (id + secret) the
// user keeps. The server only stores sha256(secret), so the code is the key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

import type { BackupData } from '@/store/backup';
import { parseBackup } from '@/store/backup';
import { BRAND } from '@/theme';

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
  const res = await fetch(`${API}/api/backup/${c.id}`, {
    method: 'PUT',
    // Gzipped: hand JSON shrinks ~10x and the server takes at most 4.4 MB.
    headers: { 'content-type': 'application/gzip', 'x-backup-key': c.secret },
    body: gzipSync(strToU8(JSON.stringify(data))).buffer as ArrayBuffer,
  });
  if (res.status === 413) throw new Error('too_big');
  if (res.status === 503) throw new Error('disabled');
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : 'network');
  const next = { ...c, lastAt: Date.now() };
  await saveCloud(next);
  return next;
}

export async function download(c: CloudState): Promise<BackupData> {
  const res = await fetch(`${API}/api/backup/${c.id}`, { headers: { 'x-backup-key': c.secret } });
  if (res.status === 404) throw new Error('not_found');
  if (res.status === 503) throw new Error('disabled');
  if (!res.ok) throw new Error('network');
  const bytes = new Uint8Array(await res.arrayBuffer());
  const gz = bytes[0] === 0x1f && bytes[1] === 0x8b;
  return parseBackup(strFromU8(gz ? gunzipSync(bytes) : bytes));
}

export async function removeRemote(c: CloudState): Promise<void> {
  await fetch(`${API}/api/backup/${c.id}`, { method: 'DELETE', headers: { 'x-backup-key': c.secret } }).catch(() => {});
}
